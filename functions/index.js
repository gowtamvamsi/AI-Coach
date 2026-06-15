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

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// Recipients per fan-out task. Each task is one short-lived worker invocation,
// so the per-function timeout never bounds the total send.
const EMAIL_BATCH_SIZE = 100;

// Cap on the recipient list stored on an emailJobs doc (for the admin task
// viewer). Keeps the doc well under Firestore's 1MB limit on huge sends; the
// sent/errors/skipped counters are always exact regardless of this cap.
const EMAIL_JOB_RECIPIENT_CAP = 5000;
function jobRecipientList(recipients) {
  return recipients.slice(0, EMAIL_JOB_RECIPIENT_CAP).map((r) => ({ name: r.name || "", email: r.email }));
}

// Friendly long date (used in email bodies), rendered in IST.
function formatSessionDate(dateTime) {
  if (!dateTime) return "TBA";
  try {
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) return String(dateTime);
    return date.toLocaleDateString("en-IN", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }) + " (IST)";
  } catch (e) {
    return String(dateTime);
  }
}

// Short date like "Thu, 25 Jun" for the communication-timeline bullets.
function formatShortDate(ms) {
  try {
    return new Date(ms).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  } catch (e) {
    return "";
  }
}

// Explains the upcoming email cadence inside the confirmation email: the Zoom
// link is emailed as soon as it's finalised (or shown now if already set), and
// reminders go out every day for the 2 days before the session.
function buildCommsTimeline(dateTime, hasZoom) {
  const start = dateTime ? new Date(dateTime).getTime() : NaN;
  const lines = ["--- What happens next ---"];
  if (hasZoom) {
    lines.push("• Zoom link: Your private joining link is included above — save it.");
  } else {
    lines.push("• Zoom link: We'll email your private Zoom joining link as soon as it's finalised.");
  }
  if (!isNaN(start)) {
    lines.push(`• Reminders: We'll send you a reminder every day for the 2 days before the session — ${formatShortDate(start - 2 * ONE_DAY_MS)} and ${formatShortDate(start - 1 * ONE_DAY_MS)} — so it never slips your mind.`);
  } else {
    lines.push("• Reminders: We'll send you a reminder every day for the 2 days before the session.");
  }
  return lines.join("\n");
}

// Build a communication email (Zoom-link drop or a reminder) for one registrant.
// `kind` is "zoom" (sent when an admin adds the link), "reminder2" (2 days
// before) or "reminder1" (the day before). Per-masterclass overrides are read
// from optional fields on the session doc (emailZoomSubject / emailZoomNote /
// emailReminderSubject / emailReminderNote / emailFinalReminderSubject).
// Returns null for the Zoom email when no link is set.
function buildMasterclassCommEmail(kind, m, reg) {
  const title = reg.sessionTitle || m.title || "Masterclass";
  const name = reg.studentName || "there";
  const when = formatSessionDate(m.dateTime);
  const zoomLink = m.zoomLink || "";
  const prepPdfUrl = m.prepPdfUrl || "";
  const sign = `\n\nSee you live,\nBalaji Chippada Masterclass\nteam@balajichippada.com`;

  if (kind === "zoom") {
    if (!zoomLink) return null;
    const subject = m.emailZoomSubject || `Your Zoom link for ${title} 🔗`;
    const body = `Hi ${name},\n\n` +
      `Here's your private Zoom joining link for ${title}:\n\n` +
      `Class: ${title}\n` +
      `Date & Time: ${when}\n` +
      `Zoom link: ${zoomLink}\n\n` +
      (prepPdfUrl ? `Prep / study guide: ${prepPdfUrl}\n\n` : "") +
      `Save this email — we'll also send you a reminder on each of the 2 days before the session.` +
      (m.emailZoomNote ? `\n\n${m.emailZoomNote}` : "") + sign;
    return { subject, body };
  }

  const isFinal = kind === "reminder1";
  const subject = isFinal
    ? (m.emailFinalReminderSubject || `Tomorrow: ${title} 🚀`)
    : (m.emailReminderSubject || `Reminder: ${title} is in 2 days ⏳`);
  const lead = isFinal
    ? `This is your final reminder — ${title} is tomorrow!`
    : `Just a heads-up — ${title} is happening in 2 days.`;
  const body = `Hi ${name},\n\n${lead}\n\n` +
    `Date & Time: ${when}\n` +
    (zoomLink ? `Zoom link: ${zoomLink}\n` : `Zoom link: It's in the email we sent with your joining link.\n`) +
    (prepPdfUrl ? `Prep / study guide: ${prepPdfUrl}\n` : "") +
    (m.emailReminderNote ? `\n${m.emailReminderNote}\n` : "") + sign;
  return { subject, body };
}

// Build the "your masterclass is cancelled" email for one registrant.
function buildCancellationEmail(m, reg, reason) {
  const title = reg.sessionTitle || m.title || "the masterclass";
  const name = reg.studentName || "there";
  const when = formatSessionDate(m.dateTime);
  const isFree = reg.isFree === true || Number(reg.amount) === 0 || reg.price === 0;
  const subject = m.emailCancellationSubject || `Cancelled: ${title}`;
  let body = `Hi ${name},\n\n` +
    `We're sorry to let you know that "${title}"${m.dateTime ? ` scheduled for ${when}` : ""} has been cancelled.\n\n`;
  if (reason) body += `${reason}\n\n`;
  if (!isFree) {
    body += `Your payment will be refunded in full — please allow 5–7 business days. If you don't see it, just reply to this email.\n\n`;
  }
  body += `We're sorry for the inconvenience and will let you know as soon as a new date is announced.\n\n` +
    `Best regards,\nBalaji Chippada Masterclass\nteam@balajichippada.com`;
  return { subject, body };
}

// Build a calendar (.ics) file string so registrants can one-click add the
// masterclass to Google/Apple/Outlook calendars. Returns null without a date.
function pad2(n) { return String(n).padStart(2, "0"); }
function toICSDate(d) {
  return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) +
    "T" + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + "Z";
}
function buildMasterclassICS(sessionData, title, sessionId) {
  if (!sessionData || !sessionData.dateTime) return null;
  const start = new Date(sessionData.dateTime);
  if (isNaN(start.getTime())) return null;
  const durationMin = Number(sessionData.duration) > 0 ? Number(sessionData.duration) : 180;
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  const location = sessionData.zoomLink || "Online (Zoom link emailed before the session)";
  const instructor = sessionData.instructor || "Balaji Chippada";
  const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const uid = `${sessionId || "mc"}-${start.getTime()}@balajichippada.com`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Agent Engineer//Masterclass//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(`${title} with ${instructor}. ` + (sessionData.zoomLink ? `Join: ${sessionData.zoomLink}` : "Your Zoom link will be emailed before the session."))}`,
    `LOCATION:${esc(location)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// Wrap an .ics string as an email attachment (used by both nodemailer & Resend).
function icsAttachment(ics) {
  if (!ics) return [];
  return [{
    filename: "masterclass.ics",
    content: ics,
    contentType: "text/calendar; method=PUBLISH; charset=UTF-8",
  }];
}

// Substitute {{placeholders}} in an admin-edited email template, per recipient.
// Supported: {{name}} {{title}} {{date}} {{zoom}} {{prep}}.
function applyTemplate(str, vars) {
  return String(str || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
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
      // Snapshot session details for the confirmation / reminder emails.
      price: price,
      isFree: false,
      sessionDateTime: sessionData.dateTime || null,
      sessionDuration: sessionData.duration || null,
      instructor: typeof sessionData.instructor === "object"
        ? (sessionData.instructor.name || "Balaji Chippada")
        : (sessionData.instructor || "Balaji Chippada"),
      zoomLink: sessionData.zoomLink || "",
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

exports.sendAudienceEmail = functions.runWith({ timeoutSeconds: 540, memory: "512MB" }).https.onCall(async (data, context) => {
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
      ...(smtpPass !== "none" && {
        auth: {
          user: smtpEmail,
          pass: smtpPass
        }
      })
    });

    // To protect recipient privacy, we send to SMTP_EMAIL and add leads to BCC!
    const mailOptions = {
      from: `"Balaji Chippada Masterclass" <${smtpEmail}>`,
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
            from: "Balaji Chippada Masterclass <team@balajichippada.com>",
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
          ...(smtpPass !== "none" && {
            auth: { user: smtpEmail, pass: smtpPass }
          })
        });

        await transporter.sendMail({
          from: `"Balaji Chippada Masterclass" <${smtpEmail}>`,
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

// Reuse one pooled SMTP transporter across the whole invocation. Opening a
// fresh connection per email (the old behaviour) made bulk sends so slow they
// blew past the function timeout. Pooling reuses up to a few connections.
let _smtpTransporter = null;
function getSmtpTransporter(smtpEmail, smtpPass) {
  if (_smtpTransporter) return _smtpTransporter;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "465");
  _smtpTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    pool: true,
    maxConnections: 5,
    ...(smtpPass !== "none" && { auth: { user: smtpEmail, pass: smtpPass } }),
  });
  return _smtpTransporter;
}

async function sendEmailHelper({ email, name, subject, body, resendApiKey, smtpEmail, smtpPass, from, attachments }) {
  // From-address resolution. Resend rejects sending from an unverified domain
  // (e.g. a gmail.com SMTP login), so when Resend is active we must use the
  // verified domain address — never the SMTP login. Precedence:
  //   explicit `from` arg  →  EMAIL_FROM env  →  domain default (Resend) / SMTP login (SMTP).
  const DOMAIN_FROM = "Balaji Chippada Masterclass <team@balajichippada.com>";
  const defaultFrom = from
    || process.env.EMAIL_FROM
    || (resendApiKey
      ? DOMAIN_FROM
      : (smtpEmail ? `"Balaji Chippada Masterclass" <${smtpEmail}>` : DOMAIN_FROM));
  const atts = Array.isArray(attachments) ? attachments : [];

  if (resendApiKey) {
    const payload = {
      from: defaultFrom,
      to: email,
      subject: subject,
      text: body
    };
    if (atts.length) {
      // Resend expects base64-encoded attachment content.
      payload.attachments = atts.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString("base64"),
        content_type: a.contentType,
      }));
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) return;
    const errText = await response.text();
    throw new Error(`Resend failed (${response.status}): ${errText}`);
  }

  if (smtpEmail && smtpPass) {
    const transporter = getSmtpTransporter(smtpEmail, smtpPass);

    await transporter.sendMail({
      from: defaultFrom,
      to: email,
      subject: subject,
      text: body,
      ...(atts.length && {
        attachments: atts.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType }))
      })
    });
    return;
  }

  console.log(`[DRIP MOCK EMAIL] From: ${defaultFrom} | To: ${email} | Subject: ${subject}${atts.length ? ` | Attachments: ${atts.map((a) => a.filename).join(", ")}` : ""}\nBody:\n${body}`);
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

        // Resolve session details from Firestore, falling back to the snapshot
        // stored on the registration — so masterclasses that live only in
        // site.config (no Firestore doc) still get the right date / price / ICS.
        const session = await lookupSession(sessionId, collection);
        const fs = session ? session.data : {};
        const effectiveSession = {
          dateTime: fs.dateTime || afterData.sessionDateTime || null,
          duration: fs.duration || afterData.sessionDuration || null,
          zoomLink: fs.zoomLink || afterData.zoomLink || "",
          prepPdfUrl: fs.prepPdfUrl || afterData.prepPdfUrl || "",
          instructor: fs.instructor || afterData.instructor || "Balaji Chippada",
          description: fs.description || fs.rawSyllabus || "",
          price: (typeof fs.price === "number") ? fs.price
            : (typeof afterData.price === "number") ? afterData.price : null,
          emailConfirmationSubject: fs.emailConfirmationSubject,
          emailConfirmationIntro: fs.emailConfirmationIntro,
          emailConfirmationNote: fs.emailConfirmationNote,
        };

        const instructor = typeof effectiveSession.instructor === "object"
          ? (effectiveSession.instructor.name || "Balaji Chippada")
          : effectiveSession.instructor;
        const zoomLink = effectiveSession.zoomLink;
        const prepPdfUrl = effectiveSession.prepPdfUrl;
        const description = effectiveSession.description;
        const formattedDate = formatSessionDate(effectiveSession.dateTime);

        // Show the actual cost — "Free" or the price in ₹ — instead of a bare
        // tier label.
        const isFree = afterData.isFree === true || effectiveSession.price === 0 || Number(afterData.amount) === 0;
        const priceText = isFree
          ? "Free"
          : (typeof effectiveSession.price === "number"
            ? `₹${effectiveSession.price.toLocaleString("en-IN")}${tier && tier !== "Standard" ? ` (${tier})` : ""}`
            : (tier || "—"));

        // Per-masterclass customisation (Firestore-only optional overrides).
        const customSubject = effectiveSession.emailConfirmationSubject;
        const customIntro = effectiveSession.emailConfirmationIntro;
        const customNote = effectiveSession.emailConfirmationNote;

        const subject = customSubject || `Confirmed: Your seat is reserved for ${sessionTitle}! 🚀`;

        let body = `Hi ${studentName || "there"},\n\n` +
          (customIntro
            ? `${customIntro}\n\n`
            : `Your registration is confirmed! Here are the details of the session you have reserved:\n\n`) +
          `Class: ${sessionTitle}\n` +
          `Instructor: ${instructor}\n` +
          `Date & Time: ${formattedDate}\n` +
          `Price: ${priceText}\n\n`;

        if (description) {
          body += `--- Course Details & Syllabus ---\n${description}\n\n`;
        }

        // If a Zoom link already exists (e.g. last-minute registration), share
        // it now; otherwise the timeline below explains when it will arrive.
        if (zoomLink) {
          body += `Your Zoom joining link is ready: ${zoomLink}\n\n`;
        }

        body += buildCommsTimeline(effectiveSession.dateTime, !!zoomLink) + "\n\n";

        body += `--- Preparation ---\n`;
        if (prepPdfUrl) {
          body += `Preparation / study guide: ${prepPdfUrl}\n\n`;
        } else {
          body += `No prep guide is required — just bring your laptop and your curiosity.\n\n`;
        }

        if (customNote) {
          body += `${customNote}\n\n`;
        }

        body += `We are super excited to have you join us! If you have any questions, feel free to reply directly to this email.\n\n` +
          `Best regards,\n` +
          `Balaji Chippada Masterclass\n` +
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
          from: "Balaji Chippada Masterclass <team@balajichippada.com>",
          attachments: icsAttachment(buildMasterclassICS(effectiveSession, sessionTitle, sessionId))
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

// ===============================================================
// Scheduled masterclass reminders
// Sends a reminder every day for the 2 days before each session
// ("in 2 days" on T-2, "tomorrow" on T-1). Runs once a day; dedup
// flags on each registration doc (reminder2Sent / reminder1Sent)
// guarantee each reminder goes out at most once. The Zoom link is
// sent separately, on demand, via sendZoomLinkToRegistrants.
// ===============================================================
async function processMasterclassComms() {
  const now = Date.now();
  const stats = { groups: 0, batches: 0, queued: 0 };

  // Registration-driven so it works even for masterclasses that live only in
  // site.config (no Firestore doc). Session details come from the Firestore doc
  // when present, otherwise from the snapshot stored on the registration.
  let regsSnap;
  try {
    regsSnap = await db.collection("registrations").where("status", "==", "completed").get();
  } catch (e) {
    console.error("[MC COMMS] Failed to read registrations:", e);
    return stats;
  }

  const sessionCache = {};
  const resolveSession = async (sessionId, collection) => {
    if (!sessionId) return null;
    if (sessionCache[sessionId] !== undefined) return sessionCache[sessionId];
    let data = null;
    try {
      const s = await lookupSession(sessionId, collection);
      data = s ? s.data : null;
    } catch (e) {
      data = null;
    }
    sessionCache[sessionId] = data;
    return data;
  };

  // Bucket recipients by (session, reminder kind) so each group shares one
  // template. We only QUEUE work here (no inline sending) so the daily run
  // stays fast even with tens of thousands of registrants.
  const groups = new Map(); // `${sessionId}|${kind}` -> { sessionId, kind, m, recipients[] }

  for (const regDoc of regsSnap.docs) {
    const reg = regDoc.data();
    if (!reg.studentEmail) continue;
    if (reg.cancelled) continue; // masterclass was cancelled — no reminders

    const fs = await resolveSession(reg.sessionId, reg.collection) || {};
    if (fs.deleted || fs.status === "deleted") continue; // cancelled/removed session
    const dateTime = fs.dateTime || reg.sessionDateTime;
    if (!dateTime) continue;
    const start = new Date(dateTime).getTime();
    if (isNaN(start)) continue;

    const daysUntil = (start - now) / ONE_DAY_MS;
    // Calendar days until the session (floor maps a morning run to the right bucket).
    const d = Math.floor(daysUntil);
    if (daysUntil < -0.5 || daysUntil > 4) continue;

    // One reminder per day for the 2 days before: "in 2 days" (T-2), "tomorrow" (T-1).
    let kind = null;
    if (!reg.reminder2Sent && d === 2) kind = "reminder2";
    else if (!reg.reminder1Sent && d === 1) kind = "reminder1";
    if (!kind) continue;

    const key = `${reg.sessionId}|${kind}`;
    let group = groups.get(key);
    if (!group) {
      const m = Object.assign({}, fs, {
        title: reg.sessionTitle || fs.title || "Masterclass",
        dateTime,
        duration: fs.duration || reg.sessionDuration || null,
        zoomLink: fs.zoomLink || reg.zoomLink || "",
        prepPdfUrl: fs.prepPdfUrl || reg.prepPdfUrl || "",
        instructor: fs.instructor || reg.instructor || "Balaji Chippada",
      });
      group = { sessionId: reg.sessionId, kind, m, recipients: [] };
      groups.set(key, group);
    }
    group.recipients.push({ regId: regDoc.id, email: reg.studentEmail, name: reg.studentName || "there" });
  }

  // Fan out each group into batches on the email-batch queue.
  const { getFunctions } = require("firebase-admin/functions");
  const queue = getFunctions().taskQueue("processEmailBatch");

  for (const group of groups.values()) {
    const { m, kind, recipients, sessionId } = group;
    const def = buildMasterclassCommEmail(kind, m, { studentName: "{{name}}", sessionTitle: m.title });
    if (!def) continue;
    const baseVars = { title: m.title, date: formatSessionDate(m.dateTime), zoom: m.zoomLink || "", prep: m.prepPdfUrl || "" };
    const ics = buildMasterclassICS(m, m.title, sessionId);
    const flagField = kind === "reminder2" ? "reminder2Sent" : "reminder1Sent";
    stats.groups++;

    // Progress-tracker doc so reminders show up in the admin task viewer too.
    const jobRef = db.collection("emailJobs").doc();
    await jobRef.set({
      type: kind === "reminder2" ? "reminder-48h" : "reminder-24h",
      label: kind === "reminder2" ? "48h reminder" : "24h reminder",
      sessionId, title: m.title,
      total: recipients.length, sent: 0, errors: 0, skipped: 0,
      recipients: jobRecipientList(recipients),
      recipientsTruncated: recipients.length > EMAIL_JOB_RECIPIENT_CAP,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: "scheduler",
    });

    for (let i = 0; i < recipients.length; i += EMAIL_BATCH_SIZE) {
      await queue.enqueue({
        jobId: jobRef.id,
        flagField,
        subjectTpl: def.subject,
        bodyTpl: def.body,
        baseVars, ics,
        recipients: recipients.slice(i, i + EMAIL_BATCH_SIZE),
      });
      stats.batches++;
    }
    stats.queued += recipients.length;
  }

  console.log("[MC COMMS] Run complete:", JSON.stringify(stats));
  return stats;
}

// Runs daily at 09:00 IST.
exports.sendMasterclassCommsScheduled = functions.runWith({ timeoutSeconds: 540, memory: "512MB" }).pubsub
  .schedule("0 9 * * *")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    try {
      await processMasterclassComms();
    } catch (err) {
      console.error("[MC COMMS] Scheduled run failed:", err);
    }
    return null;
  });

// Manual admin trigger — useful for testing without waiting for the daily run.
exports.sendMasterclassComms = functions.runWith({ timeoutSeconds: 540, memory: "512MB" }).https.onCall(async (data, context) => {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  if (!isEmulator) {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
    }
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    const role = callerDoc.exists ? callerDoc.data().role : "";
    if (role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Access denied. Admins only.");
    }
  }
  try {
    const stats = await processMasterclassComms();
    return { success: true, stats };
  } catch (err) {
    console.error("Manual sendMasterclassComms failed:", err);
    throw new functions.https.HttpsError("internal", err.message || "Failed.");
  }
});

// ===============================================================
// Add / update a masterclass Zoom link and email it to everyone
// already registered. Persists the link as the canonical source so
// later confirmations + reminders include it automatically. Admin-only.
// ===============================================================
exports.sendZoomLinkToRegistrants = functions.runWith({ timeoutSeconds: 540, memory: "512MB" }).https.onCall(async (data, context) => {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  if (!isEmulator) {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
    }
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    const role = callerDoc.exists ? callerDoc.data().role : "";
    if (role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Access denied. Admins only.");
    }
  }

  const sessionId = ((data && data.sessionId) || "").trim();
  const zoomLink = ((data && data.zoomLink) || "").trim();
  // Optional admin-edited email content (with {{name}} etc. placeholders).
  const customSubject = ((data && data.customSubject) || "").trim();
  const customBody = (data && data.customBody) || "";
  if (!sessionId) throw new functions.https.HttpsError("invalid-argument", "sessionId is required.");
  if (!zoomLink) throw new functions.https.HttpsError("invalid-argument", "zoomLink is required.");

  const regsSnap = await db.collection("registrations").where("sessionId", "==", sessionId).get();

  // Persist the link as the canonical source (used by future confirmation +
  // reminder emails). Seed details from a registration so a config-only
  // masterclass still resolves cleanly.
  const session = await lookupSession(sessionId);
  const collection = session ? session.collection : "masterclasses";
  const sample = regsSnap.docs.map((d) => d.data()).find((r) => r.status === "completed");
  const meta = { zoomLink, zoomLinkUpdatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (!session && sample) {
    if (sample.sessionTitle) meta.title = sample.sessionTitle;
    if (sample.sessionDateTime) meta.dateTime = sample.sessionDateTime;
    if (sample.sessionDuration) meta.duration = sample.sessionDuration;
    if (sample.instructor) meta.instructor = sample.instructor;
  }
  try {
    await db.collection(collection).doc(sessionId).set(meta, { merge: true });
  } catch (e) {
    console.warn(`[ZOOM SEND] Could not persist link to ${collection}/${sessionId}:`, e);
  }

  const fs = Object.assign({}, session ? session.data : {}, { zoomLink });
  const title = (sample && sample.sessionTitle) || fs.title || "Masterclass";
  const dateTime = fs.dateTime || (sample && sample.sessionDateTime) || null;
  const m = Object.assign({}, fs, {
    title, dateTime, zoomLink,
    duration: fs.duration || (sample && sample.sessionDuration) || null,
    prepPdfUrl: fs.prepPdfUrl || (sample && sample.prepPdfUrl) || "",
    instructor: fs.instructor || (sample && sample.instructor) || "Balaji Chippada",
  });

  // Build the email template ONCE; only {{name}} varies per recipient.
  let subjectTpl, bodyTpl;
  if (customBody.trim()) {
    subjectTpl = customSubject || `Your Zoom link for ${title} 🔗`;
    bodyTpl = customBody;
  } else {
    const def = buildMasterclassCommEmail("zoom", m, { studentName: "{{name}}", sessionTitle: title });
    subjectTpl = def ? def.subject : `Your Zoom link for ${title} 🔗`;
    bodyTpl = def ? def.body : "";
  }
  const baseVars = { title, date: formatSessionDate(dateTime), zoom: zoomLink, prep: m.prepPdfUrl };
  const ics = buildMasterclassICS(m, title, sessionId); // identical for every recipient

  // Recipients who still need the link.
  const recipients = [];
  regsSnap.forEach((d) => {
    const reg = d.data();
    if (reg.status !== "completed" || !reg.studentEmail || reg.zoomLinkSent) return;
    recipients.push({ regId: d.id, email: reg.studentEmail, name: reg.studentName || "there" });
  });

  if (recipients.length === 0) {
    return { success: true, queued: 0, batches: 0, message: "Everyone registered already has the link." };
  }

  // Progress tracker doc (watch emailJobs/{jobId} for live counts).
  const jobRef = db.collection("emailJobs").doc();
  await jobRef.set({
    type: "zoom", label: "Zoom link", sessionId, title,
    total: recipients.length, sent: 0, errors: 0, skipped: 0,
    recipients: jobRecipientList(recipients),
    recipientsTruncated: recipients.length > EMAIL_JOB_RECIPIENT_CAP,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: (context.auth && context.auth.uid) || "emulator",
  });

  // Fan out into Cloud Tasks batches. Each task sends a chunk in its own
  // short-lived worker (processEmailBatch), so no single function can hit the
  // timeout — this is what makes 50k+ feasible. Tune EMAIL_BATCH_SIZE and the
  // worker's rateLimits to your email provider's allowed send rate.
  const { getFunctions } = require("firebase-admin/functions");
  const queue = getFunctions().taskQueue("processEmailBatch");
  let batches = 0;
  for (let i = 0; i < recipients.length; i += EMAIL_BATCH_SIZE) {
    await queue.enqueue({
      jobId: jobRef.id,
      flagField: "zoomLinkSent",
      extraUpdate: { zoomLink },
      subjectTpl, bodyTpl, baseVars, ics,
      recipients: recipients.slice(i, i + EMAIL_BATCH_SIZE),
    });
    batches++;
  }

  console.log(`[ZOOM SEND] ${sessionId}: queued ${recipients.length} email(s) in ${batches} batch(es), job ${jobRef.id}`);
  return { success: true, queued: recipients.length, batches, jobId: jobRef.id };
});

// ===============================================================
// Fan-out worker: sends one batch of emails per Cloud Tasks dispatch.
// Generic (zoom links, reminders, cancellations can all use it). Retry-safe:
// re-checks the per-recipient flag so a retried task never double-sends.
// Tune rateLimits to match your email provider's allowed throughput.
// ===============================================================
exports.processEmailBatch = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .tasks.taskQueue({
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 30, maxBackoffSeconds: 300 },
    rateLimits: { maxConcurrentDispatches: 3, maxDispatchesPerSecond: 1 },
  })
  .onDispatch(async (payload) => {
    const { jobId, flagField, extraUpdate, subjectTpl, bodyTpl, baseVars, ics, recipients } = payload || {};
    if (!Array.isArray(recipients) || recipients.length === 0) return;

    const resendApiKey = process.env.RESEND_API_KEY;
    const smtpEmail = process.env.SMTP_EMAIL;
    const smtpPass = process.env.SMTP_PASSWORD;
    const attachments = ics
      ? [{ filename: "masterclass.ics", content: ics, contentType: "text/calendar; method=PUBLISH; charset=UTF-8" }]
      : [];
    let sent = 0, errors = 0, skipped = 0;
    const failures = []; // { email, name, error } for the admin task viewer

    for (const r of recipients) {
      try {
        const regRef = db.collection("registrations").doc(r.regId);
        const snap = await regRef.get();
        if (!snap.exists) { skipped++; continue; }
        if (flagField && snap.data()[flagField]) { skipped++; continue; } // already sent (retry-safe)

        const vars = Object.assign({}, baseVars, { name: r.name || "there" });
        await sendEmailHelper({
          email: r.email,
          name: r.name,
          subject: applyTemplate(subjectTpl, vars),
          body: applyTemplate(bodyTpl, vars),
          resendApiKey, smtpEmail, smtpPass,
          from: process.env.EMAIL_FROM || "Balaji Chippada Masterclass <team@balajichippada.com>",
          attachments,
        });
        const update = Object.assign({}, extraUpdate || {});
        if (flagField) {
          update[flagField] = true;
          update[`${flagField}At`] = admin.firestore.FieldValue.serverTimestamp();
        }
        await regRef.update(update);
        sent++;
      } catch (e) {
        const msg = String((e && e.message) || e || "Unknown error").slice(0, 300);
        console.error(`[BATCH ${jobId || "?"}] send failed for ${r.email}:`, e);
        failures.push({ email: r.email, name: r.name || "", error: msg });
        errors++;
      }
    }

    if (jobId) {
      const update = {
        sent: admin.firestore.FieldValue.increment(sent),
        errors: admin.firestore.FieldValue.increment(errors),
        skipped: admin.firestore.FieldValue.increment(skipped),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      // Record why each failed send failed (capped so a mass failure can't blow
      // past Firestore's 1MB doc limit — the counters above stay exact either way).
      if (failures.length) update.failures = admin.firestore.FieldValue.arrayUnion(...failures.slice(0, 200));
      await db.collection("emailJobs").doc(jobId).set(update, { merge: true });
    }
  });

// ===============================================================
// Notify registrants that a masterclass has been cancelled. Marks
// registrations as cancelled so scheduled reminders stop. Admin-only.
// ===============================================================
exports.sendMasterclassCancellation = functions.runWith({ timeoutSeconds: 540, memory: "512MB" }).https.onCall(async (data, context) => {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  if (!isEmulator) {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
    }
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    const role = callerDoc.exists ? callerDoc.data().role : "";
    if (role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Access denied. Admins only.");
    }
  }

  const sessionId = ((data && data.sessionId) || "").trim();
  const reason = ((data && data.reason) || "").trim();
  if (!sessionId) throw new functions.https.HttpsError("invalid-argument", "sessionId is required.");

  const regsSnap = await db.collection("registrations").where("sessionId", "==", sessionId).get();
  const session = await lookupSession(sessionId);
  const fs = session ? session.data : {};
  const sample = regsSnap.docs.map((d) => d.data()).find((r) => r.status === "completed");
  const dateTime = fs.dateTime || (sample && sample.sessionDateTime) || null;
  const startMs = dateTime ? new Date(dateTime).getTime() : NaN;

  // Don't email "cancelled" about a session that has already happened.
  if (!isNaN(startMs) && startMs < Date.now() - ONE_DAY_MS) {
    console.log(`[CANCEL] ${sessionId} is in the past — not emailing.`);
    return { success: true, queued: 0, batches: 0, skippedPast: true };
  }

  // Build the cancellation template once. Free/paid (refund line) is decided at
  // the class level from a representative registration; only {{name}} varies.
  const m = Object.assign({}, fs, { title: (sample && sample.sessionTitle) || fs.title || "Masterclass", dateTime });
  const repReg = Object.assign({ studentName: "{{name}}" },
    sample ? { isFree: sample.isFree, amount: sample.amount, price: sample.price } : { price: fs.price });
  const def = buildCancellationEmail(m, repReg, reason);

  const recipients = [];
  regsSnap.forEach((d) => {
    const reg = d.data();
    if (reg.status !== "completed" || !reg.studentEmail || reg.cancellationSent) return;
    recipients.push({ regId: d.id, email: reg.studentEmail, name: reg.studentName || "there" });
  });

  if (recipients.length === 0) {
    return { success: true, queued: 0, batches: 0, message: "No registrants to notify." };
  }

  const jobRef = db.collection("emailJobs").doc();
  await jobRef.set({
    type: "cancellation", label: "Cancellation notice", sessionId, title: m.title,
    total: recipients.length, sent: 0, errors: 0, skipped: 0,
    recipients: jobRecipientList(recipients),
    recipientsTruncated: recipients.length > EMAIL_JOB_RECIPIENT_CAP,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: (context.auth && context.auth.uid) || "emulator",
  });

  // Fan out — also flags each registration cancelled (so reminders stop) via extraUpdate.
  const { getFunctions } = require("firebase-admin/functions");
  const queue = getFunctions().taskQueue("processEmailBatch");
  let batches = 0;
  for (let i = 0; i < recipients.length; i += EMAIL_BATCH_SIZE) {
    await queue.enqueue({
      jobId: jobRef.id,
      flagField: "cancellationSent",
      extraUpdate: { cancelled: true },
      subjectTpl: def.subject,
      bodyTpl: def.body,
      baseVars: {},
      ics: null,
      recipients: recipients.slice(i, i + EMAIL_BATCH_SIZE),
    });
    batches++;
  }

  console.log(`[CANCEL] ${sessionId}: queued ${recipients.length} in ${batches} batch(es), job ${jobRef.id}`);
  return { success: true, queued: recipients.length, batches, jobId: jobRef.id };
});

// ===============================================================
// Public support chatbot — answers basic visitor questions about the
// roadmap & masterclasses, grounded on site knowledge, via Gemini.
// The API key stays server-side (GEMINI_API_KEY); it is never exposed to
// the browser. Per-IP rate limiting + short output keep abuse/cost bounded.
// ===============================================================
const CHATBOT_KNOWLEDGE = `ABOUT: Balaji Chippada teaches production-grade Agentic AI engineering. The site has two things: (1) a FREE, open 26-week "Agentic AI Engineer" roadmap (9 phases, ~60 modules, ~150K YouTube views) and (2) live, demo-first masterclasses.

ROADMAP PHASES (26 weeks, free, no paywall): 1) Python Foundations, 2) The Mental Model of an LLM, 3) Prompt Engineering & API Access, 4) RAG + Evaluation, 5) Tools, MCP & Single Agents, 6) Memory & Context Engineering, 7) Multi-Agent Orchestration, 8) Guardrails & LLMOps, 9) Cloud Infrastructure & Deployment. There are 3 capstone projects. Prerequisite: you can write basic Python and use a terminal.

MASTERCLASSES: Live ~3-hour build sessions. The FIRST masterclass is FREE; future ones are paid (around ₹499). Sessions are recorded and emailed to registrants within 48 hours. A certificate of completion is issued after attending (or via the recording for paid ones). Language: English for technical content with some Telugu where it helps; Q&A welcomes Hindi/Telugu.

REGISTRATION & LOGISTICS: Reserve a seat on the site — name + email, no payment for the free class. The Zoom link is emailed on registration and reappears ~15 min before start; reminders also go to the WhatsApp community. To watch videos on the site, create a free account (sign in). Prep: a laptop with Python 3.10+, VS Code, and API access (Anthropic/OpenAI free tiers work).

REFUNDS: 100% refund within 24 hours of purchase, no questions asked. The free masterclass has nothing to refund.

CONTACT: Email team@balajichippada.com (replies within ~24h). WhatsApp community and YouTube (@balajichippada) are linked on the site.`;

async function chatbotRateLimitOk(ip) {
  if (!ip) return true;
  const safe = ip.replace(/[^\w.:-]/g, "_").slice(0, 120);
  const ref = db.collection("chatRateLimits").doc(safe);
  const WINDOW_MS = 60 * 1000, MAX = 12;
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const d = snap.exists ? snap.data() : null;
      if (!d || now - (d.windowStart || 0) > WINDOW_MS) {
        tx.set(ref, { windowStart: now, count: 1 });
        return true;
      }
      if ((d.count || 0) >= MAX) return false;
      tx.update(ref, { count: (d.count || 0) + 1 });
      return true;
    });
  } catch (e) {
    return true; // fail-open: never block real users on a rate-limit hiccup
  }
}

exports.chatbot = functions.runWith({ timeoutSeconds: 60, memory: "256MB" }).https.onCall(async (data, context) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const message = String((data && data.message) || "").trim().slice(0, 600);
  const history = Array.isArray(data && data.history) ? data.history.slice(-8) : [];
  const mc = (data && data.context) || {};
  if (!message) throw new functions.https.HttpsError("invalid-argument", "Empty message.");

  if (!apiKey) {
    return { reply: "Our assistant isn't set up yet — please email team@balajichippada.com or ask in the WhatsApp community and we'll help you out." };
  }

  // Per-IP rate limit (fail-open).
  const fwd = (context.rawRequest && context.rawRequest.headers && context.rawRequest.headers["x-forwarded-for"]) || "";
  const ip = (String(fwd).split(",")[0] || (context.rawRequest && context.rawRequest.ip) || "").trim();
  if (!(await chatbotRateLimitOk(ip))) {
    return { reply: "You're sending messages a little fast — give it a few seconds and try again. 🙂" };
  }

  const liveFacts = [];
  if (mc.title) liveFacts.push(`Next masterclass: "${mc.title}".`);
  if (mc.dateTime) liveFacts.push(`Scheduled for: ${mc.dateTime}.`);
  if (typeof mc.price === "number") {
    liveFacts.push(mc.price === 0 ? `It is FREE to attend${mc.originalPrice ? ` (normally ₹${mc.originalPrice})` : ""}.` : `Price: ₹${mc.price}.`);
  }

  const systemPrompt = `You are the friendly support assistant on Balaji Chippada's website. Answer ONLY questions about the roadmap, the masterclasses, registration/logistics, and using this site. Keep replies short (1–4 sentences), warm, and accurate. NEVER invent prices, dates, or policies — if you're unsure, say so and point them to team@balajichippada.com or the WhatsApp community. If a question is off-topic (not about this site / its roadmap / its masterclasses / learning AI engineering here), politely decline and steer back. Do not output code unless asked about a roadmap topic.

SITE KNOWLEDGE:
${CHATBOT_KNOWLEDGE}

CURRENT SESSION FACTS:
${liveFacts.join("\n") || "(none provided — if asked about the next session's exact date/price, tell them to check the site.)"}`;

  const contents = [];
  history.forEach((h) => {
    if (h && h.role && h.text) {
      contents.push({ role: h.role === "bot" ? "model" : "user", parts: [{ text: String(h.text).slice(0, 1000) }] });
    }
  });
  contents.push({ role: "user", parts: [{ text: message }] });

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
      }),
    });
    if (!res.ok) {
      const errTxt = await res.text();
      console.error("[chatbot] Gemini error", res.status, errTxt.slice(0, 300));
      return { reply: "Sorry, I hit a snag answering that. Please email team@balajichippada.com or ask in the WhatsApp community." };
    }
    const resp = await res.json();
    const reply = resp && resp.candidates && resp.candidates[0] && resp.candidates[0].content
      && resp.candidates[0].content.parts && resp.candidates[0].content.parts[0]
      && resp.candidates[0].content.parts[0].text;
    return { reply: (reply || "").trim() || "I'm not sure about that one — please email team@balajichippada.com and we'll help." };
  } catch (e) {
    console.error("[chatbot] exception", e);
    return { reply: "Sorry, something went wrong. Please email team@balajichippada.com." };
  }
});

