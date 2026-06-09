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
      ignoreTLS: true,
      ...(smtpPass !== "none" && {
        auth: {
          user: smtpEmail,
          pass: smtpPass
        }
      })
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

exports.onLeadCreated = functions.firestore
  .document("leads/{leadId}")
  .onCreate(async (snap, context) => {
    const leadId = context.params.leadId;
    const leadData = snap.data();
    const email = leadData.email;
    const name = leadData.name || "";
    const source = leadData.source || "general";

    console.log(`[LEAD TRIGGER] New lead captured: ${email} (Name: ${name}, Source: ${source})`);

    const utmParams = {
      utm_source: leadData.utm_source || "",
      utm_medium: leadData.utm_medium || "",
      utm_campaign: leadData.utm_campaign || "",
      utm_content: leadData.utm_content || "",
      utm_term: leadData.utm_term || ""
    };

    const loopsApiKey = process.env.LOOPS_API_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (loopsApiKey) {
      try {
        const firstName = name.split(" ")[0] || "";
        const response = await fetch("https://app.loops.so/api/v1/contacts/create", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${loopsApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: email,
            firstName: firstName,
            source: source,
            userGroup: "Leads",
            utmSource: utmParams.utm_source,
            utmMedium: utmParams.utm_medium,
            utmCampaign: utmParams.utm_campaign,
            utmContent: utmParams.utm_content,
            utmTerm: utmParams.utm_term
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          console.log(`[LOOPS SUCCESS] Synced lead ${leadId} to Loops. Result:`, resJson);
          await snap.ref.update({ loopsSynced: true, welcomeEmailSent: true });
          return;
        } else {
          const errMsg = await response.text();
          console.warn(`[LOOPS WARNING] Loops sync failed with status ${response.status}: ${errMsg}`);
        }
      } catch (err) {
        console.error("[LOOPS ERROR] Loops sync exception:", err);
      }
    }

    const subject = "Welcome to The Agent Engineer + Your 26-Week Roadmap! 🚀";
    const body = `Hi ${name || "there"},\n\n` +
      `Welcome to The Agent Engineer community! I'm thrilled to have you here.\n\n` +
      `As promised, here is the direct link to download/access the full 26-Week Agentic AI Engineer Roadmap:\n` +
      `https://github.com/ch-balaji/ai-engineer-roadmap\n\n` +
      `You can also bookmark your live interactive roadmap progress tracker on our website:\n` +
      `https://balajichippada.com/\n\n` +
      `Over the next few days, I'll send you a couple of study guides to help you set up your Python environment, configure Claude Code, and get access to the APIs we use in the cohorts.\n\n` +
      `If you have any questions or get stuck on any phase, feel free to reply directly to this email or join our WhatsApp community:\n` +
      `https://chat.whatsapp.com/KbBr6JNlToy4e5M34MrOsY?mode=gi_t\n\n` +
      `Let's build some amazing agentic systems together!\n\n` +
      `Best,\n` +
      `Balaji Chippada\n` +
      `The Agent Engineer`;

    if (resendApiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "The Agent Engineer <team@balajichippada.com>",
            to: email,
            subject: subject,
            text: body
          })
        });

        if (response.ok) {
          console.log(`[RESEND SUCCESS] Sent Welcome Email to ${email} via Resend.`);
          await snap.ref.update({ 
            welcomeEmailSent: true, 
            emailEngine: "resend",
            sentEmails: admin.firestore.FieldValue.arrayUnion({
              type: "Welcome Roadmap",
              subject: subject,
              body: body,
              sentAt: new Date().toISOString()
            })
          });
          return;
        } else {
          const errMsg = await response.text();
          console.warn(`[RESEND WARNING] Resend email failed with status ${response.status}: ${errMsg}`);
        }
      } catch (err) {
        console.error("[RESEND ERROR] Resend exception:", err);
      }
    }

    const smtpEmail = process.env.SMTP_EMAIL;
    const smtpPass = process.env.SMTP_PASSWORD;
    if (smtpEmail && smtpPass) {
      try {
        const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
        const smtpPort = parseInt(process.env.SMTP_PORT || "465");
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          ignoreTLS: true,
          ...(smtpPass !== "none" && {
            auth: { user: smtpEmail, pass: smtpPass }
          })
        });

        await transporter.sendMail({
          from: `"The Agent Engineer" <${smtpEmail}>`,
          to: email,
          subject: subject,
          text: body
        });

        console.log(`[SMTP SUCCESS] Sent Welcome Email to ${email} via Nodemailer.`);
        await snap.ref.update({ 
          welcomeEmailSent: true, 
          emailEngine: "smtp",
          sentEmails: admin.firestore.FieldValue.arrayUnion({
            type: "Welcome Roadmap",
            subject: subject,
            body: body,
            sentAt: new Date().toISOString()
          })
        });
        return;
      } catch (err) {
        console.error("[SMTP ERROR] Nodemailer SMTP exception:", err);
      }
    }

    console.log(`[SMTP MOCK WELCOME EMAIL] Logged simulated welcome email to ${email}.\nSubject: ${subject}\nBody:\n${body}`);
    await snap.ref.update({ 
      welcomeEmailSent: true, 
      isMock: true,
      sentEmails: admin.firestore.FieldValue.arrayUnion({
        type: "Welcome Roadmap",
        subject: subject,
        body: body,
        sentAt: new Date().toISOString()
      })
    });
  });

async function sendEmailHelper({ email, name, subject, body, resendApiKey, smtpEmail, smtpPass, from }) {
  const defaultFrom = from || (smtpEmail ? `"The Agent Engineer" <${smtpEmail}>` : "The Agent Engineer <team@balajichippada.com>");

  if (resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: defaultFrom,
        to: email,
        subject: subject,
        text: body
      })
    });
    if (response.ok) return;
    const errText = await response.text();
    throw new Error(`Resend failed (${response.status}): ${errText}`);
  }

  if (smtpEmail && smtpPass) {
    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = parseInt(process.env.SMTP_PORT || "465");
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      ignoreTLS: true,
      ...(smtpPass !== "none" && {
        auth: { user: smtpEmail, pass: smtpPass }
      })
    });

    await transporter.sendMail({
      from: defaultFrom,
      to: email,
      subject: subject,
      text: body
    });
    return;
  }

  console.log(`[DRIP MOCK EMAIL] From: ${defaultFrom} | To: ${email} | Subject: ${subject}\nBody:\n${body}`);
}

async function processDrips() {
  const now = admin.firestore.Timestamp.now();
  const oneDayAgo = new Date(now.toDate().getTime() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.toDate().getTime() - 3 * 24 * 60 * 60 * 1000);

  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPass = process.env.SMTP_PASSWORD;

  let stats = {
    gettingStartedSent: 0,
    inviteSent: 0,
    errors: 0
  };

  const email2Snap = await db.collection("leads")
    .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(oneDayAgo))
    .get();

  for (const doc of email2Snap.docs) {
    const lead = doc.data();
    if (lead.gettingStartedEmailSent === true) continue;

    const name = lead.name || "";
    const email = lead.email;
    const subject = "Phase 1: Getting Started with Python & LLM Mental Models";
    const body = `Hi ${name || "there"},\n\n` +
      `I hope you've had a chance to look over the 26-Week Agentic AI Engineer Roadmap!\n\n` +
      `Phase 1 is all about building a solid foundation. If you want to build autonomous systems, you must write clean, asynchronous Python first. Here is your quick checklist to get started this week:\n\n` +
      `1. Set up Python 3.10+ and virtual environments (venv/conda).\n` +
      `2. Get comfortable with basic HTTP requests (using standard libraries or requests/httpx).\n` +
      `3. Understand the basic mental model of an LLM: it is a next-token prediction engine, not a database.\n\n` +
      `To track your progress and mark modules as completed, sign in to your dashboard on our website:\n` +
      `https://balajichippada.com/\n\n` +
      `Tomorrow, we'll dive into prompt caching and tool calling patterns.\n\n` +
      `Best,\n` +
      `Balaji Chippada\n` +
      `The Agent Engineer`;

    try {
      await sendEmailHelper({ email, name, subject, body, resendApiKey, smtpEmail, smtpPass });
      await doc.ref.update({ 
        gettingStartedEmailSent: true, 
        gettingStartedEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        sentEmails: admin.firestore.FieldValue.arrayUnion({
          type: "Getting Started (Email 2)",
          subject: subject,
          body: body,
          sentAt: new Date().toISOString()
        })
      });
      stats.gettingStartedSent++;
    } catch (err) {
      console.error(`[DRIP ERROR] Failed to send Email 2 to ${email}:`, err);
      stats.errors++;
    }
  }

  const email3Snap = await db.collection("leads")
    .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(threeDaysAgo))
    .get();

  for (const doc of email3Snap.docs) {
    const lead = doc.data();
    if (lead.inviteEmailSent === true) continue;

    const name = lead.name || "";
    const email = lead.email;
    const subject = "Live Cohort: Build a production-grade Claude Code agent with me!";
    const body = `Hi ${name || "there"},\n\n` +
      `By now, you should have your local development environment ready.\n\n` +
      `The best way to solidify your learning is to build in real time. I'm hosting an exclusive live masterclass where we will configure Claude Code, set up Model Context Protocol (MCP) servers, and build a self-correcting repository agent from scratch in 3 hours.\n\n` +
      `Secure your seat here:\n` +
      `https://balajichippada.com/\n\n` +
      `Looking forward to seeing you there!\n\n` +
      `Best,\n` +
      `Balaji Chippada\n` +
      `The Agent Engineer`;

    try {
      await sendEmailHelper({ email, name, subject, body, resendApiKey, smtpEmail, smtpPass });
      await doc.ref.update({ 
        inviteEmailSent: true, 
        inviteEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        sentEmails: admin.firestore.FieldValue.arrayUnion({
          type: "Invite to Masterclass (Email 3)",
          subject: subject,
          body: body,
          sentAt: new Date().toISOString()
        })
      });
      stats.inviteSent++;
    } catch (err) {
      console.error(`[DRIP ERROR] Failed to send Email 3 to ${email}:`, err);
      stats.errors++;
    }
  }

  console.log(`[DRIP COMPLETED] Stats: Email 2 sent: ${stats.gettingStartedSent}, Email 3 sent: ${stats.inviteSent}, Errors: ${stats.errors}`);
  return stats;
}

exports.processDripCampaign = functions.https.onCall(async (data, context) => {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  if (!isEmulator && !context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
  }
  
  if (!isEmulator) {
    const callerUid = context.auth.uid;
    const callerDoc = await db.collection("users").doc(callerUid).get();
    const role = callerDoc.exists ? callerDoc.data().role : "";
    if (role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Access denied. Only administrators can trigger drip runs.");
    }
  }

  try {
    const stats = await processDrips();
    return { success: true, stats };
  } catch (err) {
    console.error("Manual processDripCampaign failed:", err);
    throw new functions.https.HttpsError("internal", err.message || "Drip processing failed.");
  }
});

exports.processDripCampaignScheduled = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async (context) => {
    try {
      await processDrips();
      return null;
    } catch (err) {
      console.error("Scheduled drip campaign execution failed:", err);
      return null;
    }
  });

exports.onRegistrationCompleted = functions.firestore
  .document("registrations/{registrationId}")
  .onWrite(async (change, context) => {
    try {
      const beforeData = change.before ? change.before.data() : null;
      const afterData = change.after ? change.after.data() : null;

      // If document was deleted, do nothing
      if (!afterData) return null;

      // Check transition to "completed" status
      const wasCompleted = beforeData && beforeData.status === "completed";
      const isCompleted = afterData.status === "completed";

      // If it is completed now and wasn't before
      if (isCompleted && !wasCompleted) {
        const registrationId = context.params.registrationId;
        const studentEmail = afterData.studentEmail;
        const studentName = afterData.studentName || "";
        const sessionTitle = afterData.sessionTitle || "Masterclass";
        const sessionId = afterData.sessionId;
        const collection = afterData.collection || "masterclasses";
        const tier = afterData.tier || "Standard";

        console.log(`[REGISTRATION COMPLETED] Sending course details email to ${studentEmail} for ${sessionTitle} (Reg ID: ${registrationId})`);

        // Look up session details from Firestore for dates, zoom links, instructors, and description
        const session = await lookupSession(sessionId, collection);
        const sessionData = session ? session.data : {};
        
        const instructor = sessionData.instructor || "Balaji Chippada";
        const zoomLink = sessionData.zoomLink || "";
        const prepPdfUrl = sessionData.prepPdfUrl || "";
        const description = sessionData.description || sessionData.rawSyllabus || "";

        let formattedDate = "TBA";
        if (sessionData.dateTime) {
          try {
            const date = new Date(sessionData.dateTime);
            formattedDate = date.toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true
            }) + " (IST)";
          } catch (e) {
            formattedDate = sessionData.dateTime;
          }
        }

        const subject = `Confirmed: Your seat is reserved for ${sessionTitle}! 🚀`;
        
        let body = `Hi ${studentName || "there"},\n\n` +
          `Your registration is confirmed! Here are the details of the session/cohort you have reserved:\n\n` +
          `Class: ${sessionTitle}\n` +
          `Instructor: ${instructor}\n` +
          `Date & Time: ${formattedDate}\n` +
          `Tier: ${tier}\n\n`;

        if (description) {
          body += `--- Course Details & Syllabus ---\n${description}\n\n`;
        }

        body += `--- Preparation & Zoom Link ---\n`;
        if (zoomLink) {
          body += `Zoom Meeting Link: ${zoomLink}\n`;
        } else {
          body += `Zoom Meeting Link: Will be shared closer to the session date.\n`;
        }

        if (prepPdfUrl) {
          body += `Preparation/Study Guide: ${prepPdfUrl}\n\n`;
        } else {
          body += `Preparation/Study Guide: No prep guides required for this session.\n\n`;
        }

        body += `We are super excited to have you join us! If you have any questions, feel free to reply directly to this email.\n\n` +
          `Best regards,\n` +
          `The Agent Engineer Team\n` +
          `team@balajichippada.com`;

        const resendApiKey = process.env.RESEND_API_KEY;
        const smtpEmail = process.env.SMTP_EMAIL;
        const smtpPass = process.env.SMTP_PASSWORD;

        await sendEmailHelper({
          email: studentEmail,
          name: studentName,
          subject,
          body,
          resendApiKey,
          smtpEmail,
          smtpPass,
          from: "The Agent Engineer <team@balajichippada.com>"
        });

        // Update the registration document to show that the details email has been sent
        await change.after.ref.update({
          detailsEmailSent: true,
          detailsEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      return null;
    } catch (err) {
      console.error("[REGISTRATION ERROR] Failed to process registration email trigger:", err);
      return null;
    }
  });

