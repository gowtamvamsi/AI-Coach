#!/usr/bin/env node
/*
 * ONE-TIME CLEANUP — removes redundant duplicate booking docs.
 *
 * Some users have 2–3 booking docs for the SAME class because the old booking
 * flow used .add() (a new doc every time someone re-booked), which made the
 * class show up multiple times in "My Account". This keeps the most recent
 * active booking per (user, class) and deletes the older duplicates. It never
 * touches cancelled/deleted docs, and never deletes a class's only booking.
 *
 *   Dry run (writes nothing):
 *     GOOGLE_APPLICATION_CREDENTIALS=/path/key.json node scripts/cleanup-duplicate-bookings.cjs
 *   Apply:
 *     GOOGLE_APPLICATION_CREDENTIALS=/path/key.json node scripts/cleanup-duplicate-bookings.cjs --apply
 */
const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'balaji-chippada-agentic-ai' });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const ms = (b) => {
  const v = b.bookedAt && b.bookedAt.toDate ? b.bookedAt.toDate() : (b.bookedAt ? new Date(b.bookedAt) : null);
  return v && !isNaN(v) ? v.getTime() : 0;
};

(async () => {
  const snap = await db.collectionGroup('bookings').get();
  // group active bookings by user uid + class id
  const groups = {};
  snap.forEach((doc) => {
    const b = doc.data() || {};
    if (b.status === 'cancelled' || b.deleted === true) return; // never touch these
    const uid = doc.ref.parent.parent ? doc.ref.parent.parent.id : '?';
    const cls = b.masterclassId || b.sessionId || '?';
    const key = uid + '::' + cls;
    (groups[key] = groups[key] || []).push({ ref: doc.ref, id: doc.id, t: ms(b), title: b.masterclassTitle || b.sessionTitle || '' });
  });

  const toDelete = [];
  Object.entries(groups).forEach(([key, docs]) => {
    if (docs.length <= 1) return;
    docs.sort((a, b) => b.t - a.t); // newest first
    const keep = docs[0];
    const drop = docs.slice(1);
    console.log(`${key}  "${keep.title}"  → keep ${keep.id}, delete ${drop.length}: ${drop.map((d) => d.id).join(', ')}`);
    drop.forEach((d) => toDelete.push(d.ref));
  });

  console.log(`\nScanned ${snap.size} booking docs; ${toDelete.length} redundant duplicate(s) to delete across ${Object.values(groups).filter((g) => g.length > 1).length} group(s).`);
  if (!toDelete.length) { console.log('Nothing to do.'); process.exit(0); }
  if (!APPLY) { console.log('Dry run — re-run with --apply to delete these.'); process.exit(0); }

  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = db.batch();
    toDelete.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  console.log(`Deleted ${toDelete.length} duplicate booking doc(s).`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
