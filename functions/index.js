const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_mockKeyId12345";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "mockKeySecretValue56789";
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

async function lookupSession(sessionId, preferredCollection) {
  const collections = preferredCollection
    ? [preferredCollection, preferredCollection === "masterclasses" ? "sessions" : "masterclasses"]
    : ["masterclasses", "sessions"];

  for (const col of collections) {
    const doc = await db.collection(col).doc(sessionId).get();
    if (doc.exists) return { data: doc.data(), collection: col, ref: doc.ref };
  }
  return null;
}

exports.createRazorpayOrder = functions.https.onCall(async (data, context) => {
  try {
    const { sessionId, name, email, phone, userId, tier, tierPrice, collection } = data;

    if (!sessionId || !name || !email || !phone) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields: sessionId, name, email, phone are all required."
      );
    }

    const session = await lookupSession(sessionId, collection);
    if (!session) {
      throw new functions.https.HttpsError("not-found", `Session ${sessionId} not found.`);
    }

    const sessionData = session.data;
    const price = parseFloat(tierPrice || sessionData.price);
    if (isNaN(price) || price <= 0) {
      throw new functions.https.HttpsError("failed-precondition", "Invalid session price.");
    }

    const amountInPaise = Math.round(price * 100);
    const razorpay = getRazorpayInstance();
    const isMock = !process.env.RAZORPAY_KEY_ID;
    let orderId;

    if (isMock) {
      orderId = `order_mock_${crypto.randomBytes(6).toString("hex")}`;
    } else {
      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: `receipt_${sessionId.substring(0, 10)}_${Date.now()}`,
      });
      orderId = order.id;
    }

    await db.collection("registrations").doc().set({
      sessionId,
      sessionTitle: sessionData.title,
      studentName: name,
      studentEmail: email,
      studentPhone: phone,
      userId: userId || null,
      tier: tier || "Standard",
      orderId,
      status: "pending",
      amount: amountInPaise,
      collection: session.collection,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      orderId,
      amount: amountInPaise,
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_mockKeyId12345",
      isMock,
    };
  } catch (err) {
    console.error("Error creating Razorpay order:", err);
    throw new functions.https.HttpsError("internal", err.message || "Order creation failed.");
  }
});

async function writeUserBooking(registration, paymentId) {
  const userId = registration.userId;
  if (!userId) return;

  const session = await lookupSession(registration.sessionId, registration.collection);
  const sessionData = session ? session.data : {};

  await db.collection("users").doc(userId).collection("bookings").add({
    masterclassId: registration.sessionId,
    masterclassTitle: registration.sessionTitle,
    tier: registration.tier || "Standard",
    amount: registration.amount / 100,
    status: "confirmed",
    razorpayPaymentId: paymentId,
    razorpayOrderId: registration.orderId,
    sessionDate: sessionData.dateTime || null,
    bookedAt: admin.firestore.FieldValue.serverTimestamp(),
    zoomLink: sessionData.zoomLink || "",
    prepPdfUrl: sessionData.prepPdfUrl || "",
    recordingUrl: sessionData.recordingUrl || "",
    slidesUrl: sessionData.slidesUrl || "",
  });
}

async function incrementSeatsBooked(sessionId, collection) {
  const session = await lookupSession(sessionId, collection);
  if (!session) return;
  const booked = session.data.seatsBooked || 0;
  await session.ref.update({ seatsBooked: booked + 1 });
}

exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    let isVerified = false;

    if (!webhookSecret) {
      isVerified = true;
    } else {
      const shasum = crypto.createHmac("sha256", webhookSecret);
      shasum.update(JSON.stringify(req.body));
      isVerified = shasum.digest("hex") === signature;
    }

    if (!isVerified) return res.status(400).send("Signature verification failed.");

    const event = req.body.event;
    if (event === "payment.captured") {
      const paymentEntity = req.body.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      const registrationsSnap = await db.collection("registrations")
        .where("orderId", "==", orderId)
        .limit(1)
        .get();

      if (registrationsSnap.empty) {
        await db.collection("registrations").add({
          sessionId: paymentEntity.notes?.sessionId || "unknown",
          sessionTitle: paymentEntity.notes?.sessionTitle || "Masterclass",
          studentName: paymentEntity.notes?.studentName || paymentEntity.email,
          studentEmail: paymentEntity.email,
          studentPhone: paymentEntity.contact || "",
          orderId,
          paymentId,
          status: "completed",
          amount: paymentEntity.amount,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        const docRef = registrationsSnap.docs[0].ref;
        const regData = registrationsSnap.docs[0].data();
        await docRef.update({
          status: "completed",
          paymentId,
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await writeUserBooking(regData, paymentId);
        await incrementSeatsBooked(regData.sessionId, regData.collection);
      }
    }

    return res.status(200).json({ status: "success", received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).send(`Webhook Internal Error: ${err.message}`);
  }
});

exports.onSessionUpdateEmailer = functions.firestore
  .document("sessions/{sessionId}")
  .onUpdate(async (change, context) => {
    try {
      const beforeData = change.before.data();
      const afterData = change.after.data();
      if (beforeData.dateTime === afterData.dateTime) return null;

      const sessionId = context.params.sessionId;
      const registrationsSnap = await db.collection("registrations")
        .where("sessionId", "==", sessionId)
        .where("status", "==", "completed")
        .get();

      registrationsSnap.forEach((doc) => {
        const regData = doc.data();
        console.log(`[EMAILER] Reschedule notice for ${regData.studentEmail}: ${afterData.title} → ${afterData.dateTime}`);
      });

      return { success: true };
    } catch (err) {
      console.error("onSessionUpdateEmailer failed:", err);
      return null;
    }
  });

// Secure HTTPS Callable function to send direct programmatic emails from Admin Panel
const nodemailer = require("nodemailer");

exports.sendAudienceEmail = functions.https.onCall(async (data, context) => {
  // Validate that the request is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication is required to launch broadcasts."
    );
  }

  // Fetch caller's profile in Firestore to verify staff permissions
  const callerUid = context.auth.uid;
  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (!callerDoc.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Admin user profile not found."
    );
  }

  const callerData = callerDoc.data();
  const isStaff = callerData.role === "admin" || callerData.role === "teacher" || callerData.role === "support";
  if (!isStaff) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Access denied. Only authorized staff members can trigger email broadcasts."
    );
  }

  const { emails, subject, body, segmentName } = data;
  if (!emails || !Array.isArray(emails) || emails.length === 0 || !subject || !body) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields: emails (non-empty array), subject, body."
    );
  }

  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPass = process.env.SMTP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "465");
  const isMock = !smtpEmail || !smtpPass;

  // Log campaign metadata to Firestore for records & history
  const campaignRef = await db.collection("email_campaigns").add({
    segmentName: segmentName || "Custom Audience",
    subject,
    body,
    recipientCount: emails.length,
    senderEmail: smtpEmail || "simulated-sender@theagentengineer.app",
    status: isMock ? "simulated" : "sent",
    isMock,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    sentBy: callerData.name || callerData.email || callerUid
  });

  if (isMock) {
    console.log(`[SMTP MOCK] Logged simulated campaign ${campaignRef.id} to Firestore. Recipients: ${emails.length}`);
    emails.forEach(email => {
      console.log(`[SMTP MOCK EMAIL] To: ${email} | Subject: ${subject}`);
    });
    return {
      success: true,
      isMock: true,
      campaignId: campaignRef.id,
      message: `Audience email campaign simulated successfully (no SMTP keys). Saved ${emails.length} leads under campaign record ${campaignRef.id}.`
    };
  }

  try {
    // Configure NodeMailer SMTP transport
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpEmail,
        pass: smtpPass
      }
    });

    // To protect recipient privacy, we send to SMTP_EMAIL and add leads to BCC!
    const mailOptions = {
      from: `"The Agent Engineer" <${smtpEmail}>`,
      to: smtpEmail,
      bcc: emails.join(","),
      subject: subject,
      text: body
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP SUCCESS] Sent campaign ${campaignRef.id} via nodemailer:`, info.messageId);

    return {
      success: true,
      isMock: false,
      campaignId: campaignRef.id,
      messageId: info.messageId,
      message: `Audience email broadcast sent successfully to ${emails.length} recipients.`
    };
  } catch (err) {
    console.error("Nodemailer transport error:", err);
    await campaignRef.update({ status: "failed", error: err.message });
    throw new functions.https.HttpsError(
      "internal",
      `Nodemailer email transport failed: ${err.message}`
    );
  }
});

function parseYouTubePlaylistResponse(data) {
  const videos = [];
  let continuation = null;
  const seen = new WeakSet();
  function walk(node) {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (node.playlistVideoRenderer) {
      const v = node.playlistVideoRenderer;
      const title = v.title?.simpleText
        || (v.title?.runs || []).map((r) => r.text).join("")
        || "Video";
      const thumbs = v.thumbnail?.thumbnails || [];
      const thumbnail = thumbs[thumbs.length - 1]?.url
        || (v.videoId ? `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg` : "");
      if (v.videoId) videos.push({ videoId: v.videoId, title, thumbnail });
    }
    if (node.continuationItemRenderer && !continuation) {
      continuation = node.continuationItemRenderer.continuationEndpoint
        ?.continuationCommand?.token || null;
    }
    if (Array.isArray(node)) node.forEach(walk);
    else Object.keys(node).forEach((k) => walk(node[k]));
  }
  walk(data);
  return { videos, continuation };
}

function extractYtInitialDataFromHtml(html) {
  const markers = ['var ytInitialData = ', 'window["ytInitialData"] = '];
  for (const marker of markers) {
    const idx = html.indexOf(marker);
    if (idx < 0) continue;
    let start = idx + marker.length;
    let depth = 0;
    for (let i = start; i < html.length; i++) {
      if (html[i] === "{") depth++;
      else if (html[i] === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(start, i + 1));
          } catch (_) {
            return null;
          }
        }
      }
    }
  }
  return null;
}

async function fetchFullYouTubePlaylist(playlistId) {
  const ctx = {
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20250201.01.00",
        hl: "en",
        gl: "US",
      },
    },
  };
  const all = [];
  let body = { ...ctx, browseId: `VL${playlistId}` };
  let endpoint = "https://www.youtube.com/youtubei/v1/browse?prettyPrint=false";

  for (let page = 0; page < 20; page++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) break;
    const data = await res.json();
    const { videos, continuation } = parseYouTubePlaylistResponse(data);
    all.push(...videos);
    if (!continuation) break;
    endpoint = "https://www.youtube.com/youtubei/v1/next?prettyPrint=false";
    body = { ...ctx, continuation };
  }

  if (all.length === 0) {
    const html = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-Coach/1.0)" },
    }).then((r) => (r.ok ? r.text() : ""));
    const initial = html ? extractYtInitialDataFromHtml(html) : null;
    if (initial) {
      const { videos } = parseYouTubePlaylistResponse(initial);
      all.push(...videos);
    }
  }

  const seen = new Set();
  return all.filter((v) => v.videoId && !seen.has(v.videoId) && seen.add(v.videoId));
}

exports.getYouTubePlaylist = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send("");
  }

  const playlistId = req.query.list || req.query.playlistId;
  if (!playlistId || !/^PL[\w-]+$/.test(playlistId)) {
    return res.status(400).json({ error: "Invalid playlistId" });
  }

  try {
    const items = await fetchFullYouTubePlaylist(playlistId);
    return res.json({ items, count: items.length });
  } catch (err) {
    console.error("getYouTubePlaylist failed:", err);
    return res.status(500).json({ error: err.message || "Playlist fetch failed" });
  }
});
