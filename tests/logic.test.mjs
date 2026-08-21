// Pure-logic tests against the REAL shipped bundles (no Firebase, no network,
// no source changes). Run: `node --test tests/`
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { loadSiteGlobals } from './helpers/load-globals.mjs';

let g;
before(() => { g = loadSiteGlobals(); });

// ── Phone: cleaning, E.164 normalization, validation, country split ──────────
test('phone — cleanPhone keeps + and strips junk', () => {
  const V = g.V2_VALIDATE;
  assert.equal(V.cleanPhone('98765 43210'), '9876543210');
  assert.equal(V.cleanPhone('+91 98765-43210'), '+919876543210');
  assert.equal(V.cleanPhone('09876543210'), '9876543210'); // national trunk 0 stripped
});

test('phone — toE164 normalizes to +<country><number>', () => {
  const V = g.V2_VALIDATE;
  assert.equal(V.toE164('9876543210'), '+919876543210');     // bare → India
  assert.equal(V.toE164('+1 415 555 0132'), '+14155550132'); // US preserved
  assert.equal(V.toE164('+971 50 123 4567'), '+971501234567');
  assert.equal(V.toE164(''), '');
});

test('phone — isPhone accepts valid Indian + international, rejects junk', () => {
  const V = g.V2_VALIDATE;
  assert.equal(V.isPhone('9876543210'), true);
  assert.equal(V.isPhone('+14155550132'), true);
  assert.equal(V.isPhone('+447911123456'), true);
  assert.equal(V.isPhone('12345'), false);
  assert.equal(V.isPhone('abcd'), false);
});

test('phone — phoneError respects required flag', () => {
  const V = g.V2_VALIDATE;
  assert.notEqual(V.phoneError('', true), '');   // required + empty → message
  assert.equal(V.phoneError('', false), '');     // optional + empty → ok
  assert.equal(V.phoneError('+919876543210', true), '');
  assert.notEqual(V.phoneError('123', true), ''); // too short
});

test('phone — v2SplitE164 splits dial + local (longest-prefix match)', () => {
  // spread to a host-realm plain object so deepStrictEqual isn't tripped by the
  // vm sandbox's Object.prototype identity.
  const split = (v) => ({ ...g.v2SplitE164(v) });
  assert.deepEqual(split(''), { dial: '+91', local: '' });
  assert.deepEqual(split('9876543210'), { dial: '+91', local: '9876543210' });
  assert.deepEqual(split('+919876543210'), { dial: '+91', local: '9876543210' });
  assert.deepEqual(split('+14155550132'), { dial: '+1', local: '4155550132' });
  assert.deepEqual(split('+971501234567'), { dial: '+971', local: '501234567' });
});

// ── Email: format + disposable + placeholder + typo detection ────────────────
test('email — accepts real addresses', () => {
  const V = g.V2_VALIDATE;
  assert.equal(V.emailError('real.user@gmail.com'), '');
  assert.equal(V.emailError('someone@iitb.ac.in'), '');
});

test('email — rejects placeholder / disposable / typo / malformed', () => {
  const V = g.V2_VALIDATE;
  assert.notEqual(V.emailError('test@testing.com'), '');   // placeholder domain
  assert.notEqual(V.emailError('foo@example.com'), '');     // reserved/placeholder
  assert.notEqual(V.emailError('x@mailinator.com'), '');    // disposable
  assert.notEqual(V.emailError('name@gmail.con'), '');      // typo
  assert.notEqual(V.emailError('not-an-email'), '');        // format
  assert.notEqual(V.emailError('a@@b.com'), '');            // format
  assert.notEqual(V.emailError(''), '');                    // empty
});

// ── Pricing: offering/actual, free detection, strike anchor ──────────────────
test('pricing — getMcPrice / isMcFree', () => {
  assert.equal(g.getMcPrice({ price: 499 }), 499);
  assert.equal(g.getMcPrice({ price: 0 }), 0);
  assert.equal(g.getMcPrice({}), 0);            // default free, never silently charge
  assert.equal(g.isMcFree({ price: 0 }), true);
  assert.equal(g.isMcFree({ price: 499 }), false);
  assert.equal(g.isMcFree(null), false);        // no class ≠ "free"
});

test('pricing — getMcStrikePrice anchor only when it makes sense', () => {
  assert.equal(g.getMcStrikePrice({ price: 0, originalPrice: 299 }), 299); // explicit
  assert.equal(g.getMcStrikePrice({ price: 0 }), 299);                     // free fallback
  assert.equal(g.getMcStrikePrice({ price: 499, originalPrice: 999 }), 999);
  assert.equal(g.getMcStrikePrice({ price: 499 }), 0);                     // paid, no anchor → no strike
});

// ── Dates: viewer-local formatting, empty handling ───────────────────────────
test('date — formatters handle empty and render a zoned time', () => {
  assert.equal(g.formatMcShortDate(''), 'Date TBA');
  assert.equal(g.formatMcFullDateTime(''), 'Date TBA');
  const full = g.formatMcFullDateTime('2026-07-11T13:30:00.000Z');
  assert.match(full, /2026/);                          // year present
  assert.match(full, /\d{1,2}:\d{2}/);                 // a time
  assert.match(full, /(GMT|UTC|[A-Z]{2,5}\b)/);        // a timezone label (local zone)
});

// ── Curriculum ↔ video-seed integrity (catches renumber-breaks-tag bugs) ─────
test('data — roadmap module numbers are contiguous per phase', () => {
  for (const phase of g.ROADMAP) {
    const nums = (phase.sections || []).map((s) => s.n);
    nums.forEach((n, i) => {
      assert.equal(n, `${phase.id}.${i + 1}`, `phase ${phase.id} section ${i} should be ${phase.id}.${i + 1}, got ${n}`);
    });
  }
});

test('data — every seeded video maps to a module that exists in the roadmap', () => {
  const known = new Set();
  for (const phase of g.ROADMAP) for (const s of (phase.sections || [])) known.add(s.n);
  for (const v of g.ROADMAP_VIDEOS) {
    for (const m of (v.mappings || [])) {
      for (const mod of (m.modules || [])) {
        assert.ok(known.has(mod), `video "${v.id || v.youtubeId}" tags module ${mod} which no longer exists in the roadmap`);
      }
    }
  }
});

test('data — upcoming course modules use the approved video breakdown without placeholder durations', () => {
  const expectedCounts = new Map([
    ['05', 20],
    ['06', 18],
    ['07', 24],
    ['08', 17],
    ['09', 13],
    ['10', 13],
    ['11', 10],
    ['12', 11],
    ['13', 12],
    ['14', 12],
    ['15', 11],
    ['16', 12],
  ]);

  for (const mod of g.COURSE_CURRICULUM.filter((item) => expectedCounts.has(item.n))) {
    assert.equal(mod.submodules.length, expectedCounts.get(mod.n), `module ${mod.n} video count`);
    mod.submodules.forEach((lesson, i) => {
      assert.equal(lesson.n, `${Number(mod.n)}.${i + 1}`, `module ${mod.n} video ${i + 1} numbering`);
      assert.equal(lesson.secs, undefined, `module ${mod.n} video ${lesson.n} has no unfinished runtime`);
      assert.deepEqual([...lesson.lessons], [lesson.title], `module ${mod.n} video ${lesson.n} is one title-only lesson`);
      assert.equal(g.COURSE_DURATION.lessonSecs(lesson), null, `module ${mod.n} video ${lesson.n} has no placeholder runtime`);
    });
    assert.equal(g.COURSE_DURATION.moduleSecs(mod), null, `module ${mod.n} has no placeholder total duration`);
  }
});

test('data — site.config masterclass has a parseable date + non-negative price', () => {
  const mc = g.SITE_CONFIG.nextMasterclass;
  assert.ok(mc, 'nextMasterclass present');
  assert.ok(!Number.isNaN(new Date(mc.dateTime).getTime()), 'dateTime is parseable');
  assert.ok(typeof mc.price === 'number' && mc.price >= 0, 'price is a non-negative number');
});

// ── Reservation occurrence keys: a recurring series must be scoped by DATE, not
//    title alone, or a past booking marks a future date as "reserved". ─────────
test('mcOccKeys — same title + different date is NOT the same occurrence', () => {
  const title = 'Mastering Claude Code: Building Agentic Systems';
  const past = g.mcOccKeys(title, g.mcDateMs('2026-05-11T19:00:00+05:30'), 'mc-may');
  const next = g.mcOccKeys(title, g.mcDateMs('2026-07-11T19:00:00+05:30'), 'mc-jul');
  // Regression guard for the "seat booked" false-positive: no key overlaps.
  assert.equal(next.some((k) => past.includes(k)), false);
});

test('mcOccKeys — same title + same day matches even across duplicate doc ids', () => {
  const title = 'Mastering Claude Code: Building Agentic Systems';
  const booked = g.mcOccKeys(title, g.mcDateMs('2026-07-11T19:00:00+05:30'), 'doc-A');
  const featured = g.mcOccKeys(' mastering claude code: building agentic systems ',
    g.mcDateMs('2026-07-11T19:00:00+05:30'), 'doc-B'); // different id, same event
  assert.equal(featured.some((k) => booked.includes(k)), true);
});

test('mcOccKeys — dateless booking still matches its exact doc id', () => {
  const booked = g.mcOccKeys('Some Class', g.mcDateMs(null), 'doc-X');
  const featured = g.mcOccKeys('Some Class', g.mcDateMs('2026-07-11T19:00:00+05:30'), 'doc-X');
  assert.equal(featured.some((k) => booked.includes(k)), true);
});

test('mcDateMs — accepts ISO string, Firestore Timestamp, and rejects junk', () => {
  assert.equal(typeof g.mcDateMs('2026-07-11T19:00:00+05:30'), 'number');
  assert.equal(g.mcDateMs({ seconds: 1783950000 }), 1783950000 * 1000);
  assert.equal(g.mcDateMs(null), null);
  assert.equal(g.mcDateMs('not-a-date'), null);
});
