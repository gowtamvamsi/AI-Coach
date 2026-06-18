/**
 * cleanupForLaunch.js — one-time pre-launch data wipe.
 *
 * Deletes test data so the site launches clean:
 *   • ALL documents in:  registrations, leads, emailJobs
 *   • ALL non-admin users:  Firestore /users doc (incl. subcollections) + their
 *     Firebase Authentication account
 *
 * PRESERVES (never touched):
 *   • Any user whose Firestore role is admin / teacher / support
 *   • The hardcoded bootstrap admins (by email), doc AND auth account
 *   • masterclasses, sessions, roadmap content, videoCodeLinks, etc.
 *
 * SAFETY: this is a DRY RUN by default — it only counts and prints what it WOULD
 * delete. Nothing is deleted unless you pass --confirm.
 *
 *   Dry run:   node functions/cleanupForLaunch.js
 *   Execute:   node functions/cleanupForLaunch.js --confirm
 *
 * Credentials (first match wins):
 *   1.  --key=/path/to/serviceAccountKey.json
 *   2.  GOOGLE_APPLICATION_CREDENTIALS env var
 *   3.  ./serviceAccountKey.json  (this functions/ dir, or repo root)
 *   4.  Application Default Credentials (gcloud / Cloud Shell)
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// Keep this in sync with BOOTSTRAP_ADMIN_EMAILS in index.js.
const BOOTSTRAP_ADMIN_EMAILS = [
  "gowtamsbh1234@gmail.com",
  "balajichippada.20@gmail.com",
  "mayupatil199@gmail.com",
].map((e) => e.toLowerCase());

const STAFF_ROLES = ["admin", "teacher", "support"];
const COLLECTIONS_TO_WIPE = ["registrations", "leads", "emailJobs"];

const CONFIRM = process.argv.includes("--confirm");
const keyArg = process.argv.find((a) => a.startsWith("--key="));

// ── Resolve credentials ────────────────────────────────────────────────────
function initAdmin() {
  const candidates = [
    keyArg ? keyArg.slice("--key=".length) : null,
    process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "..", "serviceAccountKey.json"),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const sa = require(path.resolve(p));
      admin.initializeApp({ credential: admin.credential.cert(sa) });
      console.log(`🔑 Using service account: ${p}  (project: ${sa.project_id})`);
      return;
    }
  }
  // Fall back to ADC (gcloud / Cloud Shell).
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  console.log("🔑 Using Application Default Credentials.");
}

// Delete every doc in a collection (handles subcollections via recursiveDelete).
async function wipeCollection(db, name) {
  const snap = await db.collection(name).get();
  console.log(`\n📂 ${name}: ${snap.size} document(s)`);
  if (!CONFIRM || snap.empty) return snap.size;
  let n = 0;
  for (const doc of snap.docs) {
    await db.recursiveDelete(doc.ref); // removes the doc + any subcollections
    n += 1;
  }
  console.log(`   🗑️  deleted ${n} document(s) from ${name}`);
  return snap.size;
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const auth = admin.auth();

  console.log(`\n${"=".repeat(64)}`);
  console.log(CONFIRM ? "⚠️  EXECUTE MODE — deletions WILL happen" : "🧪 DRY RUN — nothing will be deleted (pass --confirm to execute)");
  console.log("=".repeat(64));

  // ── 1. Build the preserve set from the users collection ──────────────────
  const usersSnap = await db.collection("users").get();
  const preserveUids = new Set();
  const preserveEmails = new Set(BOOTSTRAP_ADMIN_EMAILS);
  const preservedList = [];
  const toDeleteUserDocs = [];

  usersSnap.forEach((doc) => {
    const d = doc.data() || {};
    const email = (d.email || "").toLowerCase();
    const isStaff = STAFF_ROLES.includes(d.role);
    const isBootstrap = email && BOOTSTRAP_ADMIN_EMAILS.includes(email);
    if (isStaff || isBootstrap) {
      preserveUids.add(doc.id);
      if (email) preserveEmails.add(email);
      preservedList.push(`${email || "(no email)"} — role=${d.role || "?"} — uid=${doc.id}`);
    } else {
      toDeleteUserDocs.push({ id: doc.id, email });
    }
  });

  // Sanity guard: we must always preserve the bootstrap admins.
  if (preserveEmails.size === 0) {
    console.error("❌ ABORT: preserve set is empty — refusing to delete everything.");
    process.exit(1);
  }

  console.log(`\n👑 PRESERVED admin/staff accounts (${preservedList.length} matched in /users):`);
  preservedList.forEach((l) => console.log(`   ✓ ${l}`));
  console.log(`   (plus bootstrap emails always preserved: ${BOOTSTRAP_ADMIN_EMAILS.join(", ")})`);

  // ── 2. Wipe the bulk test collections ────────────────────────────────────
  for (const name of COLLECTIONS_TO_WIPE) {
    await wipeCollection(db, name);
  }

  // ── 3. Delete non-admin Firestore /users docs (recursive) ────────────────
  console.log(`\n📂 users: ${usersSnap.size} total · ${preservedList.length} preserved · ${toDeleteUserDocs.length} to delete`);
  if (CONFIRM) {
    let n = 0;
    for (const u of toDeleteUserDocs) {
      await db.recursiveDelete(db.collection("users").doc(u.id));
      n += 1;
    }
    console.log(`   🗑️  deleted ${n} user document(s) (+ their subcollections)`);
  }

  // ── 4. Delete non-admin Firebase Auth accounts ───────────────────────────
  // Iterate ALL auth users (catches anonymous guests + orphans with no doc).
  let authTotal = 0;
  const authToDelete = [];
  let pageToken;
  do {
    const res = await auth.listUsers(1000, pageToken);
    for (const u of res.users) {
      authTotal += 1;
      const email = (u.email || "").toLowerCase();
      const keep = preserveUids.has(u.uid) || (email && preserveEmails.has(email));
      if (!keep) authToDelete.push(u.uid);
    }
    pageToken = res.pageToken;
  } while (pageToken);

  console.log(`\n🔐 Firebase Auth: ${authTotal} total · ${authTotal - authToDelete.length} preserved · ${authToDelete.length} to delete`);
  if (CONFIRM && authToDelete.length) {
    // deleteUsers handles up to 1000 uids per call.
    let deleted = 0;
    for (let i = 0; i < authToDelete.length; i += 1000) {
      const batch = authToDelete.slice(i, i + 1000);
      const r = await auth.deleteUsers(batch);
      deleted += r.successCount;
      if (r.failureCount) {
        console.warn(`   ⚠️  ${r.failureCount} auth deletions failed:`);
        r.errors.forEach((e) => console.warn(`      [${e.index}] ${e.error.message}`));
      }
    }
    console.log(`   🗑️  deleted ${deleted} auth account(s)`);
  }

  console.log(`\n${"=".repeat(64)}`);
  console.log(CONFIRM ? "✅ Cleanup complete." : "🧪 Dry run complete — re-run with --confirm to execute.");
  console.log("=".repeat(64) + "\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
