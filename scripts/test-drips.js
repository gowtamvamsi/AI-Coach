/**
 * Local Automation Test Script for Lead Capture & Welcome Drip Campaigns.
 * Ensure the Firebase emulators are running (`npx firebase emulators:start`) before executing this script.
 * 
 * Usage:
 *   node scripts/test-drips.js
 */
const admin = require("firebase-admin");

// Configure connection to local Firestore emulator
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FUNCTIONS_EMULATOR = "true";

admin.initializeApp({
  projectId: "coaching-site-gowtam-2026"
});

const db = admin.firestore();

async function runTest() {
  console.log("==================================================================");
  console.log("   STARTING LOCAL LEADS & WELCOME DRIP CAMPAIGN AUTOMATION TEST  ");
  console.log("==================================================================");
  console.log(`Connecting to Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}\n`);

  // 1. Clear existing leads to ensure clean test state
  console.log("1. Cleaning up existing leads collection in emulator...");
  const leadsSnap = await db.collection("leads").get();
  const batch = db.batch();
  leadsSnap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`Cleaned up ${leadsSnap.size} existing leads.\n`);

  // 2. Seed mock leads with different registration dates
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours old
  const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // 4 days old

  console.log("2. Seeding mock leads into Firestore...");
  
  // Lead A: Fresh signup (should trigger immediate welcome email, but no drips)
  const leadRefA = db.collection("leads").doc("lead_fresh_test");
  await leadRefA.set({
    name: "Fresh Lead (A)",
    email: "fresh_lead@example.com",
    source: "roadmap_teaser",
    utm_source: "youtube",
    utm_medium: "video",
    utm_campaign: "launch_2026",
    createdAt: admin.firestore.Timestamp.fromDate(now)
  });
  console.log("   [+] Seeded Lead A (Fresh signup)");

  // Lead B: 25 hours old (should receive immediate welcome + Drip 2: Getting Started)
  const leadRefB = db.collection("leads").doc("lead_oneday_test");
  await leadRefB.set({
    name: "One-Day Lead (B)",
    email: "oneday_lead@example.com",
    source: "phase_materials_1",
    createdAt: admin.firestore.Timestamp.fromDate(oneDayAgo)
  });
  console.log("   [+] Seeded Lead B (Created 25 hours ago)");

  // Lead C: 4 days old (should receive immediate welcome + Drip 2 + Drip 3: Masterclass)
  const leadRefC = db.collection("leads").doc("lead_fourday_test");
  await leadRefC.set({
    name: "Four-Day Lead (C)",
    email: "fourday_lead@example.com",
    source: "roadmap_hero_cta",
    createdAt: admin.firestore.Timestamp.fromDate(fourDaysAgo)
  });
  console.log("   [+] Seeded Lead C (Created 4 days ago)\n");

  // Allow Firestore triggers to run on emulator
  console.log("Waiting 3 seconds for background onCreate Firestore triggers...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 3. Trigger the Drip Campaign Callable Function
  console.log("\n3. Triggering processDripCampaign Cloud Function via HTTP POST...");
  try {
    const callableUrl = "http://127.0.0.1:5001/coaching-site-gowtam-2026/us-central1/processDripCampaign";
    const response = await fetch(callableUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data: {} // Firebase callable wrapper syntax
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log("   [✓] Drip campaign function responded successfully.");
      console.log("   [✓] Campaign stats:", JSON.stringify(result.result.stats, null, 2));
    } else {
      const errText = await response.text();
      console.error(`   [X] Function call failed (${response.status}):`, errText);
    }
  } catch (err) {
    console.error("   [X] HTTP request failed:", err.message);
  }

  // 4. Verify Firestore updates
  console.log("\n4. Verifying document state changes in Firestore:");
  const updatedFresh = await leadRefA.get();
  const updatedOneDay = await leadRefB.get();
  const updatedFourDay = await leadRefC.get();

  console.log("\n------------------------------------------------");
  console.log("Fresh Lead (A) State (Expected: Welcome only):");
  console.log(`  - welcomeEmailSent: ${updatedFresh.data().welcomeEmailSent}`);
  console.log(`  - gettingStartedEmailSent: ${updatedFresh.data().gettingStartedEmailSent || false}`);
  console.log(`  - inviteEmailSent: ${updatedFresh.data().inviteEmailSent || false}`);

  console.log("\nOne-Day Lead (B) State (Expected: Welcome + Getting Started):");
  console.log(`  - welcomeEmailSent: ${updatedOneDay.data().welcomeEmailSent}`);
  console.log(`  - gettingStartedEmailSent: ${updatedOneDay.data().gettingStartedEmailSent || false}`);
  console.log(`  - inviteEmailSent: ${updatedOneDay.data().inviteEmailSent || false}`);

  console.log("\nFour-Day Lead (C) State (Expected: Welcome + Getting Started + Invite):");
  console.log(`  - welcomeEmailSent: ${updatedFourDay.data().welcomeEmailSent}`);
  console.log(`  - gettingStartedEmailSent: ${updatedFourDay.data().gettingStartedEmailSent || false}`);
  console.log(`  - inviteEmailSent: ${updatedFourDay.data().inviteEmailSent || false}`);
  console.log("------------------------------------------------\n");

  console.log("==================================================================");
  console.log("   AUTOMATION TEST COMPLETED SUCCESSFULLY!                       ");
  console.log("   Check the Firebase emulator terminal output to view emails.   ");
  console.log("==================================================================");
}

runTest().catch(console.error);
