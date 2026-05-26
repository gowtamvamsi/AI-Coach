const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

/**
 * Initialize Razorpay SDK using credentials.
 * Utilizes environment variables / Firebase configuration secrets.
 * Provides fallback mock parameters for local development and testing.
 */
function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_mockKeyId12345";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "mockKeySecretValue56789";
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

/**
 * 1. createRazorpayOrder - HTTPS Callable Function
 * Receives: { sessionId, name, email, phone }
 * Logic:
 *  - Looks up the session document in Firestore to retrieve actual title and price (INR).
 *  - Initializes Razorpay client.
 *  - Creates an order via razorpay.orders.create with amount = price * 100 (in paise).
 *  - Adds a new document in registrations collection with status: 'pending'.
 *  - Returns { orderId, amount, keyId } to frontend.
 */
exports.createRazorpayOrder = functions.https.onCall(async (data, context) => {
  try {
    const { sessionId, name, email, phone } = data;
    
    // Check parameters validity
    if (!sessionId || !name || !email || !phone) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields: sessionId, name, email, phone are all required."
      );
    }

    // Lookup session in Firestore to verify price
    const sessionDoc = await db.collection("sessions").doc(sessionId).get();
    if (!sessionDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        `Masterclass session with ID ${sessionId} could not be found.`
      );
    }
    
    const sessionData = sessionDoc.data();
    const price = parseFloat(sessionData.price);
    
    if (isNaN(price) || price <= 0) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Invalid session price. Masterclass pricing must be positive."
      );
    }

    // Convert price to paise (Razorpay expects smallest currency subunit)
    const amountInPaise = Math.round(price * 100);

    const razorpay = getRazorpayInstance();
    const isMock = !process.env.RAZORPAY_KEY_ID;

    let orderId;
    
    if (isMock) {
      // Return a simulated Order ID for testing sandbox flows without secrets
      orderId = `order_mock_${crypto.randomBytes(6).toString("hex")}`;
      console.log(`[MOCK SANDBOX] Generated mock Razorpay order: ${orderId} for amount: ${amountInPaise} paise`);
    } else {
      // Create real Razorpay order
      const orderOptions = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `receipt_session_${sessionId.substring(0, 10)}_${Date.now()}`,
      };
      
      const order = await razorpay.orders.create(orderOptions);
      orderId = order.id;
      console.log(`[RAZORPAY] Created live order: ${orderId} successfully`);
    }

    // Write a pending registration in registrations collection
    const registrationRef = db.collection("registrations").doc();
    await registrationRef.set({
      sessionId: sessionId,
      sessionTitle: sessionData.title,
      studentName: name,
      studentEmail: email,
      studentPhone: phone,
      orderId: orderId,
      status: "pending",
      amount: amountInPaise,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      orderId: orderId,
      amount: amountInPaise,
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_mockKeyId12345",
      isMock: isMock
    };

  } catch (err) {
    console.error("Error creating Razorpay order:", err);
    throw new functions.https.HttpsError(
      "internal",
      err.message || "An internal error occurred while generating Razorpay order."
    );
  }
});

/**
 * 2. razorpayWebhook - HTTPS Webhook Endpoint
 * Listens for Razorpay's payment.captured event.
 * Logic:
 *  - Verifies Razorpay Webhook HMAC signature.
 *  - Identifies the orderId from the webhook payload.
 *  - Queries the registrations collection for matching pending registration.
 *  - Updates status to 'completed'.
 *  - Triggers a simulated confirmation receipt email (logs the receipt).
 */
exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
  // Webhooks are POST requests
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed. Webhook expects POST requests.");
  }

  try {
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Direct mock bypass for local verification or if no webhook secret is set yet
    let isVerified = false;

    if (!webhookSecret) {
      console.log("[WEBHOOK WARNING] No RAZORPAY_WEBHOOK_SECRET configured. Temporarily bypassing signature check for development.");
      isVerified = true;
    } else {
      const shasum = crypto.createHmac("sha256", webhookSecret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest("hex");
      isVerified = (digest === signature);
    }

    if (!isVerified) {
      console.error("[WEBHOOK ERROR] Invalid signature verification failed.");
      return res.status(400).send("Signature verification failed.");
    }

    const event = req.body.event;
    console.log(`[WEBHOOK EVENT] Received event: ${event}`);

    if (event === "payment.captured") {
      const paymentEntity = req.body.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const email = paymentEntity.email;

      console.log(`[WEBHOOK] Processing captured payment for Order: ${orderId}, Payment ID: ${paymentId}`);

      // Query registration matching orderId
      const registrationsSnap = await db.collection("registrations")
        .where("orderId", "==", orderId)
        .limit(1)
        .get();

      if (registrationsSnap.empty) {
        console.warn(`[WEBHOOK WARNING] No matching registration document found for orderId: ${orderId}`);
        // Let's create an ad-hoc completed registration to prevent losing student details
        await db.collection("registrations").add({
          sessionId: paymentEntity.notes.sessionId || "unknown_session",
          sessionTitle: paymentEntity.notes.sessionTitle || "Masterclass Master",
          studentName: paymentEntity.notes.studentName || email,
          studentEmail: email,
          studentPhone: paymentEntity.contact || "unknown",
          orderId: orderId,
          paymentId: paymentId,
          status: "completed",
          amount: paymentEntity.amount,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        const docRef = registrationsSnap.docs[0].ref;
        const regData = registrationsSnap.docs[0].data();
        
        await docRef.update({
          status: "completed",
          paymentId: paymentId,
          confirmedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Trigger confirmation receipt email (Simulated/Logged as requested)
        console.log(`
============================================================
📧 SIMULATED CONFIRMATION EMAIL SENT
To: ${regData.studentEmail}
Subject: Booking Confirmed! Masterclass Seat Secured
------------------------------------------------------------
Hello ${regData.studentName},

We are thrilled to confirm that your seat has been reserved!
Session Title: "${regData.sessionTitle || "Masterclass"}"
Amount Paid: INR ${parseFloat(regData.amount / 100).toFixed(2)}
Payment ID: ${paymentId}
Order ID: ${orderId}

Looking forward to seeing you at the class!
============================================================
        `);
      }
    }

    return res.status(200).json({ status: "success", received: true });

  } catch (err) {
    console.error("Webhook endpoint execution failed:", err);
    return res.status(500).send(`Webhook Internal Error: ${err.message}`);
  }
});

/**
 * 3. onSessionUpdateEmailer - Firestore background trigger
 * Watches sessions/{sessionId}.
 * If the dateTime field changes, it queries the registrations collection
 * for all completed registrations for this session, and sends them
 * a simulated rescheduling notice email.
 */
exports.onSessionUpdateEmailer = functions.firestore
  .document("sessions/{sessionId}")
  .onUpdate(async (change, context) => {
    try {
      const sessionId = context.params.sessionId;
      const beforeData = change.before.data();
      const afterData = change.after.data();

      // Check if dateTime field was changed
      if (beforeData.dateTime === afterData.dateTime) {
        console.log(`[EMAILER] Session ${sessionId} updated, but dateTime field was unchanged.`);
        return null;
      }

      console.log(`[EMAILER] Session "${afterData.title}" dateTime changed from: "${beforeData.dateTime}" to: "${afterData.dateTime}". Querying registrations...`);

      // Query completed registrations for this session
      const registrationsSnap = await db.collection("registrations")
        .where("sessionId", "==", sessionId)
        .where("status", "==", "completed")
        .get();

      if (registrationsSnap.empty) {
        console.log(`[EMAILER] No paid completed registrations found for session ${sessionId}. Rescheduling notice skipped.`);
        return null;
      }

      const emails = [];
      registrationsSnap.forEach((doc) => {
        const data = doc.data();
        if (data.studentEmail) {
          emails.push({
            name: data.studentName,
            email: data.studentEmail
          });
        }
      });

      console.log(`[EMAILER] Found ${emails.length} active registered student(s) to notify.`);

      // Dispatch automated rescheduling notices (Simulated/Logged as requested)
      emails.forEach((student) => {
        console.log(`
============================================================
📧 SIMULATED RESCHEDULING NOTICE EMAIL SENT
To: ${student.email}
Subject: IMPORTANT: Rescheduling Notice for "${afterData.title}" Masterclass
------------------------------------------------------------
Hello ${student.name},

Please note that the masterclass you booked, "${afterData.title}", has been rescheduled.

New Time: ${afterData.dateTime}
Original Time: ${beforeData.dateTime}

No action is required from your side. Your seat remains locked and active.
If you have any conflict, please contact support.

Best regards,
Coaching Platform Rescheduling System
============================================================
        `);
      });

      return { success: true, notifiedCount: emails.length };

    } catch (err) {
      console.error("onSessionUpdateEmailer trigger execution failed:", err);
      return null;
    }
  });
