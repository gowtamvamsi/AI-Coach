// GCLOUD_PROJECT is required by firebase-functions v1 event providers
// (firestore/pubsub) but the Cloud Functions API now rejects it as a
// user-set env var, so deploys that touch environmentVariables lose it.
// Derive it from FIREBASE_CONFIG (which is user-set and survives).
if (!process.env.GCLOUD_PROJECT && process.env.FIREBASE_CONFIG) {
  try { process.env.GCLOUD_PROJECT = JSON.parse(process.env.FIREBASE_CONFIG).projectId; } catch (e) { /* leave unset */ }
}

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const otpLib = require("./lib/otp");

admin.initializeApp();
const db = admin.firestore();

// Firestore doc id for a password-reset record (sanitized email).
function passwordResetDocId(email) {
  return otpLib.normalizeEmail(email).replace(/[^a-z0-9._@+-]/g, "_").slice(0, 400) || "_";
}

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

// Markdown-lite → HTML for email bodies, so **bold** and [label](url) written
// in the admin composer render in recipients' inboxes. Everything else stays
// plain text (escaped), with newlines as <br>. A stripped text version is sent
// alongside as the fallback part for text-only mail clients.
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function emailBodyToHtml(body) {
  const html = escapeHtml(body)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\r?\n/g, "<br>\n");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222">${html}</div>`;
}
function emailBodyToText(body) {
  return String(body)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, "$1 ($2)");
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
      `https://chat.whatsapp.com/D8YynWP15hp286CszuB5Xa\n\n` +
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
      text: emailBodyToText(body),
      html: emailBodyToHtml(body)
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
      text: emailBodyToText(body),
      html: emailBodyToHtml(body),
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
          emailConfirmationBody: fs.emailConfirmationBody,
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
        // Full-body override: replaces the assembled email entirely.
        // Supports {{name}} {{title}} {{date}} {{zoom}} placeholders.
        const customBody = effectiveSession.emailConfirmationBody;

        const subject = customSubject || `Confirmed: Your seat is reserved for ${sessionTitle}! 🚀`;

        if (customBody) {
          const body = applyTemplate(customBody, {
            name: studentName || "there",
            title: sessionTitle,
            date: formattedDate,
            zoom: zoomLink,
          });
          await sendEmailHelper({
            email: studentEmail,
            name: studentName,
            subject,
            body,
            resendApiKey: process.env.RESEND_API_KEY,
            smtpEmail: process.env.SMTP_EMAIL,
            smtpPass: process.env.SMTP_PASSWORD,
            from: "Balaji Chippada Masterclass <team@balajichippada.com>",
            attachments: icsAttachment(buildMasterclassICS(effectiveSession, sessionTitle, sessionId)),
          });
          await change.after.ref.update({
            detailsEmailSent: true,
            detailsEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return null;
        }

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

// Bootstrap administrator emails — these accounts must always be role=admin,
// enforced server-side (see enforceBootstrapAdminRole) so admin status never
// depends on the deployed client bundle recognising the email list.
const BOOTSTRAP_ADMIN_EMAILS = [
  "gowtamsbh1234@gmail.com",
  "balajichippada.20@gmail.com",
  "mayupatil199@gmail.com",
];

// ===============================================================
// Welcome email on account sign-up
// ---------------------------------------------------------------
// Fires once when a user's profile doc first gains BOTH an email and a name.
// This covers:
//   • email/password sign-up — the name is written with the doc, so it fires
//     on the create write.
//   • Google sign-in — a baseline {email, role} doc is created first (no name,
//     skipped), then the name is added at profile completion, which fires it.
// Anonymous guest-checkout users never get a name, so they're excluded. We also
// require that the name was NOT already present before this write, so existing
// users editing their profile never receive a spurious "welcome". Idempotent
// via the welcomeEmailSent flag.
// ===============================================================
exports.onUserSignupWelcome = functions.firestore
  .document("users/{userId}")
  .onWrite(async (change, context) => {
    try {
      const after = change.after.exists ? change.after.data() : null;
      if (!after) return null; // doc deleted
      const before = change.before.exists ? change.before.data() : null;

      const email = (after.email || "").trim();
      const name = (after.name || "").trim();
      const role = after.role || "client";

      if (!email || !name) return null;          // need a named account we can email
      if (after.welcomeEmailSent === true) return null; // already welcomed
      if (role !== "client") return null;        // don't email staff / admin accounts
      if (BOOTSTRAP_ADMIN_EMAILS.includes(email.toLowerCase())) return null; // never "welcome" an admin

      // Only the moment the account first becomes "named" — not later edits to
      // an already-named account (which would otherwise re-welcome people).
      const beforeHadName = !!(before && (before.name || "").toString().trim());
      if (beforeHadName) return null;

      const firstName = name.split(" ")[0] || name;
      const subject = `Welcome to the Agentic AI Engineer community, ${firstName}! 🚀`;
      const body = `Hi ${firstName},\n\n` +
        `Welcome aboard — your account is all set! I'm thrilled to have you here.\n\n` +
        `Here's how to get the most out of it:\n\n` +
        `• Follow the full 26-week Agentic AI Engineer roadmap and track your progress as you go:\n` +
        `  https://balajichippada.com/\n\n` +
        `• Reserve your seat for the next live masterclass — the first one is free:\n` +
        `  https://balajichippada.com/\n\n` +
        `Have a question or just want to say hi? Reply directly to this email, or join our WhatsApp community:\n` +
        `https://chat.whatsapp.com/D8YynWP15hp286CszuB5Xa\n\n` +
        `Let's build some amazing agentic systems together!\n\n` +
        `Best,\n` +
        `Balaji Chippada\n` +
        `team@balajichippada.com`;

      const resendApiKey = process.env.RESEND_API_KEY;
      const smtpEmail = process.env.SMTP_EMAIL;
      const smtpPass = process.env.SMTP_PASSWORD;

      console.log(`[WELCOME] Sending sign-up welcome email to ${email} (${name})`);
      await sendEmailHelper({
        email,
        name,
        subject,
        body,
        resendApiKey,
        smtpEmail,
        smtpPass,
        from: "Balaji Chippada Masterclass <team@balajichippada.com>",
      });

      // Stamp only after a successful send so a transient failure can retry on
      // the next write. (Setting the flag re-triggers onWrite, which then exits
      // early on the welcomeEmailSent check — no loop.)
      await change.after.ref.update({
        welcomeEmailSent: true,
        welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return null;
    } catch (err) {
      console.error("[WELCOME ERROR] onUserSignupWelcome failed:", err);
      return null;
    }
  });

// ===============================================================
// Password reset via 6-digit OTP (for users who forgot their password)
// ---------------------------------------------------------------
// Two callables, both usable while SIGNED OUT:
//   requestPasswordReset({ email })            → emails a 6-digit code
//   confirmPasswordReset({ email, otp, newPassword }) → verifies + resets
// The OTP (hashed) lives in the server-only `passwordResets` collection
// (no client rule → default-deny; only the admin SDK here can touch it).
// Anti-abuse: no email enumeration, 10-min expiry, 5 wrong-try cap,
// resend cooldown + per-window send cap, crypto-random codes.
// ===============================================================
exports.requestPasswordReset = functions.https.onCall(async (data) => {
  const email = otpLib.normalizeEmail(data && data.email);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new functions.https.HttpsError("invalid-argument", "Please enter a valid email address.");
  }

  const force = !!(data && data.force);

  // Look up the account. We ALWAYS return ok (never reveal whether the email
  // exists) and only actually send/store when it does.
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (e) {
    return { ok: true };
  }

  // Google-signup users have no password to "reset". Tell the UI to point them
  // at "Sign in with Google" — unless they explicitly choose to set a password
  // anyway (force), in which case we fall through and email a code.
  if (!force && otpLib.accountAuthKind(userRecord.providerData) === "google-only") {
    return { ok: true, provider: "google" };
  }

  const ref = db.collection("passwordResets").doc(passwordResetDocId(email));
  const now = Date.now();
  const existing = (await ref.get()).data() || null;

  const gate = otpLib.canSend(existing, now);
  if (!gate.allow) {
    // Throttled — still report success so attackers can't probe timing/limits.
    return { ok: true };
  }

  const otp = otpLib.generateOtp();
  const rec = otpLib.newResetRecord(email, otp, now);
  rec.uid = userRecord.uid;
  // Preserve the rolling send window so the per-hour cap actually accumulates.
  if (existing && existing.windowStart && now - existing.windowStart < otpLib.SEND_WINDOW_MS) {
    rec.windowStart = existing.windowStart;
    rec.sends = (existing.sends || 0) + 1;
  }
  await ref.set(rec);

  const firstName = (userRecord.displayName || "").split(" ")[0] || "there";
  const subject = "Your password reset code";
  const body = `Hi ${firstName},\n\n` +
    `Here is your password reset code for balajichippada.com:\n\n` +
    `    ${otp}\n\n` +
    `Enter it on the site to set a new password. This code expires in 10 minutes.\n\n` +
    `If you didn't request this, you can safely ignore this email — your password won't change.\n\n` +
    `Best,\n` +
    `Balaji Chippada\n` +
    `team@balajichippada.com`;
  try {
    await sendEmailHelper({
      email,
      name: userRecord.displayName || "",
      subject,
      body,
      resendApiKey: process.env.RESEND_API_KEY,
      smtpEmail: process.env.SMTP_EMAIL,
      smtpPass: process.env.SMTP_PASSWORD,
      from: "Balaji Chippada Masterclass <team@balajichippada.com>",
    });
  } catch (err) {
    console.error("[PWRESET] failed to send code to", email, err);
    throw new functions.https.HttpsError("internal", "Could not send the reset email. Please try again shortly.");
  }
  return { ok: true };
});

exports.confirmPasswordReset = functions.https.onCall(async (data) => {
  const email = otpLib.normalizeEmail(data && data.email);
  const otp = String((data && data.otp) || "").trim();
  const newPassword = String((data && data.newPassword) || "");

  if (!email) throw new functions.https.HttpsError("invalid-argument", "Email is required.");
  if (!otpLib.isValidOtpFormat(otp)) {
    throw new functions.https.HttpsError("invalid-argument", "Enter the 6-digit code from your email.");
  }
  const pwErr = otpLib.passwordError(newPassword);
  if (pwErr) throw new functions.https.HttpsError("invalid-argument", pwErr);

  const ref = db.collection("passwordResets").doc(passwordResetDocId(email));
  const snap = await ref.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "No reset request found. Please request a new code.");
  }
  const rec = snap.data();

  if (otpLib.isExpired(rec.expiresAt)) {
    await ref.delete();
    throw new functions.https.HttpsError("deadline-exceeded", "This code has expired. Please request a new one.");
  }
  if ((rec.attempts || 0) >= otpLib.MAX_ATTEMPTS) {
    await ref.delete();
    throw new functions.https.HttpsError("resource-exhausted", "Too many incorrect attempts. Please request a new code.");
  }
  if (!otpLib.verifyOtp(email, otp, rec.otpHash)) {
    await ref.update({ attempts: (rec.attempts || 0) + 1 });
    throw new functions.https.HttpsError("permission-denied", "Incorrect code. Please check and try again.");
  }

  // Valid → set the new password (admin SDK; the user is signed out) and burn the code.
  await admin.auth().updateUser(rec.uid, { password: newPassword });
  await ref.delete();
  return { ok: true };
});

// ===============================================================
// Email verification via 6-digit OTP at SIGN-UP
// ---------------------------------------------------------------
// Verify-first signup: the account is created server-side ONLY after the code
// is confirmed, so we know the email is real and the person controls it.
//   requestSignupOtp({ email })                                  → emails a code
//   verifySignupOtpAndCreate({ email, otp, password, name, ... }) → verify + create
// Codes (hashed) live in the server-only `signupVerifications` collection.
// Same anti-abuse as password reset (expiry, attempt cap, send rate-limit).
// ===============================================================
exports.requestSignupOtp = functions.https.onCall(async (data) => {
  const email = otpLib.normalizeEmail(data && data.email);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new functions.https.HttpsError("invalid-argument", "Please enter a valid email address.");
  }

  // Already registered → tell them to sign in (standard, expected signup UX).
  try {
    await admin.auth().getUserByEmail(email);
    return { exists: true };
  } catch (e) { /* no account yet → proceed to send a code */ }

  const ref = db.collection("signupVerifications").doc(passwordResetDocId(email));
  const now = Date.now();
  const existing = (await ref.get()).data() || null;
  const gate = otpLib.canSend(existing, now);
  if (!gate.allow) return { ok: true }; // throttle silently (anti email-bomb)

  const otp = otpLib.generateOtp();
  const rec = otpLib.newResetRecord(email, otp, now);
  if (existing && existing.windowStart && now - existing.windowStart < otpLib.SEND_WINDOW_MS) {
    rec.windowStart = existing.windowStart;
    rec.sends = (existing.sends || 0) + 1;
  }
  await ref.set(rec);

  const subject = "Your verification code";
  const body = `Hi,\n\n` +
    `Your verification code to create your balajichippada.com account is:\n\n` +
    `    ${otp}\n\n` +
    `Enter it on the site to finish signing up. This code expires in 10 minutes.\n\n` +
    `If you didn't try to sign up, you can safely ignore this email.\n\n` +
    `Best,\n` +
    `Balaji Chippada\n` +
    `team@balajichippada.com`;
  try {
    await sendEmailHelper({
      email, name: "", subject, body,
      resendApiKey: process.env.RESEND_API_KEY,
      smtpEmail: process.env.SMTP_EMAIL,
      smtpPass: process.env.SMTP_PASSWORD,
      from: "Balaji Chippada Masterclass <team@balajichippada.com>",
    });
  } catch (err) {
    console.error("[SIGNUP-OTP] failed to send code to", email, err);
    throw new functions.https.HttpsError("internal", "Could not send the verification email. Please try again shortly.");
  }
  return { ok: true };
});

exports.verifySignupOtpAndCreate = functions.https.onCall(async (data) => {
  const email = otpLib.normalizeEmail(data && data.email);
  const otp = String((data && data.otp) || "").trim();
  const password = String((data && data.password) || "");
  const name = String((data && data.name) || "").trim();
  const phone = String((data && data.phone) || "").trim();
  const userType = String((data && data.userType) || "").trim();

  if (!email) throw new functions.https.HttpsError("invalid-argument", "Email is required.");
  if (!otpLib.isValidOtpFormat(otp)) {
    throw new functions.https.HttpsError("invalid-argument", "Enter the 6-digit code from your email.");
  }
  const pwErr = otpLib.passwordError(password);
  if (pwErr) throw new functions.https.HttpsError("invalid-argument", pwErr);
  if (name.length < 2) throw new functions.https.HttpsError("invalid-argument", "Please enter your name.");

  const ref = db.collection("signupVerifications").doc(passwordResetDocId(email));
  const snap = await ref.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "No verification request found. Please start again.");
  }
  const rec = snap.data();
  if (otpLib.isExpired(rec.expiresAt)) {
    await ref.delete();
    throw new functions.https.HttpsError("deadline-exceeded", "This code has expired. Please request a new one.");
  }
  if ((rec.attempts || 0) >= otpLib.MAX_ATTEMPTS) {
    await ref.delete();
    throw new functions.https.HttpsError("resource-exhausted", "Too many incorrect attempts. Please request a new code.");
  }
  if (!otpLib.verifyOtp(email, otp, rec.otpHash)) {
    await ref.update({ attempts: (rec.attempts || 0) + 1 });
    throw new functions.https.HttpsError("permission-denied", "Incorrect code. Please check and try again.");
  }

  // Code verified → create the account (email pre-verified) + profile.
  let userRecord;
  try {
    userRecord = await admin.auth().createUser({ email, password, displayName: name, emailVerified: true });
  } catch (err) {
    if (err && err.code === "auth/email-already-exists") {
      await ref.delete();
      throw new functions.https.HttpsError("already-exists", "An account already exists for this email. Please sign in.");
    }
    if (err && err.code === "auth/invalid-password") {
      throw new functions.https.HttpsError("invalid-argument", "Password must be at least 6 characters.");
    }
    console.error("[SIGNUP-OTP] createUser failed for", email, err);
    throw new functions.https.HttpsError("internal", "Could not create your account. Please try again.");
  }

  // Profile doc — also triggers the welcome email (onUserSignupWelcome).
  await db.collection("users").doc(userRecord.uid).set(
    { name, email, phone, userType, role: "client" },
    { merge: true },
  );
  await ref.delete();
  return { ok: true };
});

// ===============================================================
// Enforce admin role for bootstrap administrators
// ---------------------------------------------------------------
// The client promotes bootstrap-admin emails to role=admin, but that relies on
// the deployed bundle knowing the email list — a stale hosting deploy (or the
// complete-profile flow) could recreate the account as role=client and strip
// admin access. This server-side guard is authoritative: whenever a bootstrap-
// admin email's user doc is written as anything other than admin, we set it back
// to admin. Idempotent — the corrective write re-fires onWrite, which then exits
// on the role check (no loop).
// ===============================================================
exports.enforceBootstrapAdminRole = functions.firestore
  .document("users/{userId}")
  .onWrite(async (change, context) => {
    try {
      const after = change.after.exists ? change.after.data() : null;
      if (!after) return null; // doc deleted
      const email = (after.email || "").trim().toLowerCase();
      if (!email || !BOOTSTRAP_ADMIN_EMAILS.includes(email)) return null;
      if (after.role === "admin") return null; // already correct
      await change.after.ref.update({ role: "admin" });
      console.log(`[ADMIN ENFORCE] Promoted bootstrap admin ${email} to role=admin`);
      return null;
    } catch (err) {
      console.error("[ADMIN ENFORCE] enforceBootstrapAdminRole failed:", err);
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
// Kill switch: create config/masterclassReminders with { disabled: true } in
// Firestore to pause the automatic reminders (no redeploy needed); delete the
// doc or set disabled: false to resume. The manual sendMasterclassComms
// callable below ignores the switch, so an admin can still send on demand.
exports.sendMasterclassCommsScheduled = functions.runWith({ timeoutSeconds: 540, memory: "512MB" }).pubsub
  .schedule("0 9 * * *")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    try {
      const ks = await db.collection("config").doc("masterclassReminders").get();
      if (ks.exists && ks.data().disabled) {
        console.log("[MC COMMS] Skipped — disabled via config/masterclassReminders kill switch.");
        return null;
      }
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

    // Ad-hoc (no-regId) sends carry each recipient's index in the job's
    // recipient list (r.idx). Delivered indices are recorded on the job doc
    // (deliveredIdx) as we go, so a Cloud Tasks retry of a partially-completed
    // batch — and the admin Retry button — only sends to who's still missing.
    const jobRef = jobId ? db.collection("emailJobs").doc(jobId) : null;
    const hasIdx = recipients.some((r) => r && r.idx != null);
    let deliveredSet = new Set();
    if (jobRef && hasIdx) {
      const js = await jobRef.get();
      deliveredSet = new Set((js.exists && js.data().deliveredIdx) || []);
    }
    let pendingIdx = [];
    // Flush every 10 sends: keeps job-doc writes ~0.1/s per worker (contention-
    // safe at 3 concurrent) while capping the re-send window on a mid-batch
    // crash to at most 10 recipients.
    const flushDelivered = async () => {
      if (!jobRef || pendingIdx.length === 0) return;
      const idxs = pendingIdx; pendingIdx = [];
      await jobRef.set({
        deliveredIdx: admin.firestore.FieldValue.arrayUnion(...idxs),
        sent: admin.firestore.FieldValue.increment(idxs.length),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    };

    for (const r of recipients) {
      if (r.idx != null && deliveredSet.has(r.idx)) continue; // delivered on a previous attempt — already counted
      try {
        // Registration-backed sends (zoom links, reminders, cancellations) read
        // the reg doc for retry-safe dedupe and to flag it sent. Ad-hoc list
        // sends (e.g. the bulk marketing upload) carry no regId — those just send.
        let regRef = null;
        if (r.regId) {
          regRef = db.collection("registrations").doc(r.regId);
          const snap = await regRef.get();
          if (!snap.exists) { skipped++; continue; }
          if (flagField && snap.data()[flagField]) { skipped++; continue; } // already sent (retry-safe)
        }

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
        if (regRef) {
          const update = Object.assign({}, extraUpdate || {});
          if (flagField) {
            update[flagField] = true;
            update[`${flagField}At`] = admin.firestore.FieldValue.serverTimestamp();
          }
          await regRef.update(update);
        }
        if (r.idx != null) pendingIdx.push(r.idx); // counted via flushDelivered
        else sent++;
      } catch (e) {
        const msg = String((e && e.message) || e || "Unknown error").slice(0, 300);
        console.error(`[BATCH ${jobId || "?"}] send failed for ${r.email}:`, e);
        failures.push({ email: r.email, name: r.name || "", error: msg });
        errors++;
      }
      if (pendingIdx.length >= 10) await flushDelivered();
    }
    await flushDelivered();

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
// Bulk marketing email from an uploaded contact list (a Name/Email/Phone
// spreadsheet, parsed in the dashboard). Admin-only. Reuses the generic
// processEmailBatch fan-out, so a large list is sent across many short-lived
// worker invocations instead of one timeout-bound call. Recipients carry no
// regId, so the worker sends them directly (no registration doc / sent flag).
// Body supports {{name}} personalization.
// ===============================================================
exports.sendBulkEmail = functions.runWith({ timeoutSeconds: 540, memory: "512MB" }).https.onCall(async (data, context) => {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  if (!isEmulator) {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
    }
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    const role = callerDoc.exists ? callerDoc.data().role : "";
    if (role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Access denied. Only admins can send bulk email.");
    }
  }

  const subject = ((data && data.subject) || "").trim();
  const body = (data && data.body) || "";
  const label = ((data && data.label) || "Spreadsheet upload").toString().slice(0, 140);
  const rawRecipients = Array.isArray(data && data.recipients) ? data.recipients : [];

  if (!subject) throw new functions.https.HttpsError("invalid-argument", "An email subject is required.");
  if (!body.trim()) throw new functions.https.HttpsError("invalid-argument", "An email body is required.");
  if (rawRecipients.length === 0) throw new functions.https.HttpsError("invalid-argument", "No recipients were provided.");

  // Optional calendar invite: { title, dateTime, duration, location }.
  // Reuses the masterclass ICS builder (location rides in as the meeting link).
  const event = (data && data.event) || null;
  let ics = null;
  if (event && event.title && event.dateTime) {
    ics = buildMasterclassICS(
      { dateTime: event.dateTime, duration: event.duration, zoomLink: String(event.location || "").trim() },
      String(event.title).trim(),
      "bulk"
    );
    if (!ics) throw new functions.https.HttpsError("invalid-argument", "The calendar event date/time could not be parsed.");
  }

  // Validate each row (skip empty / malformed emails). No de-duplication: every
  // uploaded recipient is kept, matching exactly what the admin sees in the list
  // — two people can legitimately share one inbox, each with their own {{name}}.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const recipients = [];
  const contactsToSave = [];
  for (const r of rawRecipients) {
    const email = String((r && (r.email != null ? r.email : r.Email)) || "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) continue;
    const nameRaw = String((r && (r.name != null ? r.name : r.Name)) || "").trim();
    const phone = String((r && (r.phone != null ? r.phone : r.Phone)) || "").trim();
    recipients.push({ email, name: nameRaw || "there" });
    contactsToSave.push({ email, name: nameRaw, phone });
  }

  if (recipients.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "No valid, unique email addresses were found in the uploaded list.");
  }

  // Persist the audience (deduped by email) so it can be re-emailed later from
  // the "Saved Contacts" panel. Best-effort — a persistence hiccup must never
  // block the send. Dedup happens naturally because the email is the doc id.
  try {
    const FieldValue = admin.firestore.FieldValue;
    for (let i = 0; i < contactsToSave.length; i += 400) {
      const batch = db.batch();
      contactsToSave.slice(i, i + 400).forEach((c) => {
        const doc = {
          email: c.email,
          source: label,
          updatedAt: FieldValue.serverTimestamp(),
          lastEmailedAt: FieldValue.serverTimestamp(),
          emailCount: FieldValue.increment(1),
        };
        if (c.name) doc.name = c.name;
        if (c.phone) doc.phone = c.phone;
        batch.set(db.collection("marketingContacts").doc(c.email), doc, { merge: true });
      });
      await batch.commit();
    }
    console.log(`[BULK EMAIL] persisted ${contactsToSave.length} contact(s) to marketingContacts.`);
  } catch (e) {
    console.error("[BULK EMAIL] persisting contacts failed (send still proceeds):", e);
  }

  // Progress tracker doc — live counts show in the admin Email Tasks viewer.
  const jobRef = db.collection("emailJobs").doc();
  await jobRef.set({
    type: "bulk", label, subject,
    total: recipients.length, sent: 0, errors: 0, skipped: 0,
    recipients: jobRecipientList(recipients),
    recipientsTruncated: recipients.length > EMAIL_JOB_RECIPIENT_CAP,
    // Kept on the job so retryEmailJob can re-send to undelivered recipients.
    bodyTpl: body,
    ics: ics || null,
    deliveredIdx: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: (context.auth && context.auth.uid) || "emulator",
  });

  // Fan out into processEmailBatch tasks (no regId/flagField → direct send).
  // Each recipient carries its index in the job's recipient list so delivery
  // is tracked per person (deliveredIdx) and retries never double-send.
  const { getFunctions } = require("firebase-admin/functions");
  const queue = getFunctions().taskQueue("processEmailBatch");
  const indexed = recipients.map((r, i) => ({ email: r.email, name: r.name, idx: i }));
  let batches = 0;
  for (let i = 0; i < indexed.length; i += EMAIL_BATCH_SIZE) {
    await queue.enqueue({
      jobId: jobRef.id,
      subjectTpl: subject,
      bodyTpl: body,
      baseVars: {},
      ics,
      recipients: indexed.slice(i, i + EMAIL_BATCH_SIZE),
    });
    batches++;
  }

  console.log(`[BULK EMAIL] queued ${recipients.length} email(s) in ${batches} batch(es), job ${jobRef.id} (label: ${label})`);
  return { success: true, queued: recipients.length, batches, jobId: jobRef.id, total: recipients.length };
});

// ===============================================================
// Retry a bulk email job: re-enqueue ONLY recipients not recorded in the
// job's deliveredIdx. Admin-only. Error counters reset so the task viewer's
// progress reflects the retry pass; sent/deliveredIdx keep accumulating.
// ===============================================================
exports.retryEmailJob = functions.runWith({ timeoutSeconds: 300, memory: "512MB" }).https.onCall(async (data, context) => {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  if (!isEmulator) {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
    }
    const callerDoc = await db.collection("users").doc(context.auth.uid).get();
    const role = callerDoc.exists ? callerDoc.data().role : "";
    if (role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Access denied. Only admins can retry email jobs.");
    }
  }

  const jobId = ((data && data.jobId) || "").trim();
  if (!jobId) throw new functions.https.HttpsError("invalid-argument", "A jobId is required.");
  const jobRef = db.collection("emailJobs").doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "Email task not found.");
  const job = snap.data();
  if (job.type !== "bulk" || !job.bodyTpl) {
    throw new functions.https.HttpsError("failed-precondition", "Only bulk email tasks sent after delivery tracking was added can be retried.");
  }
  const processed = (job.sent || 0) + (job.errors || 0) + (job.skipped || 0);
  if ((job.total || 0) > 0 && processed < job.total) {
    throw new functions.https.HttpsError("failed-precondition", "This task is still sending — wait for it to finish before retrying.");
  }

  // recipients is capped at EMAIL_JOB_RECIPIENT_CAP (5000); beyond that a job
  // can't be retried per-recipient (recipientsTruncated flags this in the UI).
  const recipients = Array.isArray(job.recipients) ? job.recipients : [];
  const delivered = new Set(job.deliveredIdx || []);
  const undelivered = recipients
    .map((r, i) => ({ email: r.email, name: r.name || "", idx: i }))
    .filter((r) => r.email && !delivered.has(r.idx));
  if (undelivered.length === 0) {
    return { success: true, retried: 0, batches: 0 };
  }

  // Fresh error slate for the retry pass.
  await jobRef.set({
    errors: 0, skipped: 0,
    failures: admin.firestore.FieldValue.delete(),
    retriedAt: admin.firestore.FieldValue.serverTimestamp(),
    retryCount: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const { getFunctions } = require("firebase-admin/functions");
  const queue = getFunctions().taskQueue("processEmailBatch");
  let batches = 0;
  for (let i = 0; i < undelivered.length; i += EMAIL_BATCH_SIZE) {
    await queue.enqueue({
      jobId,
      subjectTpl: job.subject || "",
      bodyTpl: job.bodyTpl,
      baseVars: {},
      ics: job.ics || null,
      recipients: undelivered.slice(i, i + EMAIL_BATCH_SIZE),
    });
    batches++;
  }
  console.log(`[RETRY EMAIL] job ${jobId}: re-queued ${undelivered.length} undelivered recipient(s) in ${batches} batch(es)`);
  return { success: true, retried: undelivered.length, batches };
});

// ===============================================================
// Cascade a masterclass/session deletion to every registrant's per-user
// booking (users/{uid}/bookings/{id}) so "My Masterclasses" reflects the
// cancellation even on a hard delete. The client already hides soft-deleted
// classes; this makes the underlying data consistent and survives hard deletes.
// Requires a collection-group index on bookings.masterclassId (firestore.indexes.json).
// ===============================================================
async function cascadeCancelDocs(snapPromise, kind, classId, isAlreadyDone, makeUpdate) {
  let snap;
  try {
    snap = await snapPromise;
  } catch (e) {
    console.error(`[CASCADE] ${kind} lookup failed for ${classId}:`, e);
    return;
  }
  let n = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    let c = 0;
    snap.docs.slice(i, i + 400).forEach((d) => {
      if (isAlreadyDone(d.data() || {})) return; // idempotent
      batch.update(d.ref, makeUpdate());
      c++; n++;
    });
    if (c > 0) await batch.commit();
  }
  console.log(`[CASCADE] ${classId}: updated ${n} ${kind}.`);
}

// Cascade a masterclass/session deletion to (1) every registrant's per-user
// booking and (2) the top-level registrations, marking them cancelled — so
// "My Masterclasses" and the registrations list stay consistent, and it works
// even on a hard delete or when no cancellation email was sent.
async function cascadeClassDeletion(classId) {
  if (!classId) return;
  const now = admin.firestore.FieldValue.serverTimestamp();
  // (1) Per-user bookings — collection-group query needs the
  //     bookings.masterclassId index (firestore.indexes.json).
  await cascadeCancelDocs(
    db.collectionGroup("bookings").where("masterclassId", "==", classId).get(),
    "booking(s)", classId,
    (d) => d.status === "cancelled",
    () => ({ status: "cancelled", cancelledAt: now, cancelledReason: "masterclass_deleted" })
  );
  // (2) Top-level registrations (sessionId == classId; auto single-field index).
  await cascadeCancelDocs(
    db.collection("registrations").where("sessionId", "==", classId).get(),
    "registration(s)", classId,
    (d) => d.cancelled === true,
    () => ({ cancelled: true, cancelledAt: now, cancelledReason: "masterclass_deleted" })
  );
}

function wasJustDeleted(before, after) {
  const del = (d) => !!(d && (d.deleted === true || d.status === "deleted"));
  return !del(before) && del(after);
}

// Soft delete (admin sets deleted/status='deleted') on a masterclass or session.
exports.onMasterclassDeleted = functions.firestore.document("masterclasses/{id}").onUpdate(async (change, context) => {
  if (!wasJustDeleted(change.before.data(), change.after.data())) return null;
  await cascadeClassDeletion(context.params.id);
  return null;
});
exports.onSessionDeleted = functions.firestore.document("sessions/{id}").onUpdate(async (change, context) => {
  if (!wasJustDeleted(change.before.data(), change.after.data())) return null;
  await cascadeClassDeletion(context.params.id);
  return null;
});

// Hard delete (doc removed) — same cascade, so nothing dangles.
exports.onMasterclassHardDeleted = functions.firestore.document("masterclasses/{id}").onDelete(async (snap, context) => {
  await cascadeClassDeletion(context.params.id);
  return null;
});
exports.onSessionHardDeleted = functions.firestore.document("sessions/{id}").onDelete(async (snap, context) => {
  await cascadeClassDeletion(context.params.id);
  return null;
});
