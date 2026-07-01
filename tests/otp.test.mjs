// Unit tests for the password-reset OTP logic (functions/lib/otp.js).
// Pure functions only — no Firebase, no network. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const otp = require('../functions/lib/otp.js');

test('generateOtp — always a 6-digit string in range, and varies', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const code = otp.generateOtp();
    assert.match(code, /^\d{6}$/, `got "${code}"`);
    const n = Number(code);
    assert.ok(n >= 0 && n <= 999999);
    seen.add(code);
  }
  assert.ok(seen.size > 100, 'codes should not be constant');
});

test('normalizeEmail — trims and lowercases', () => {
  assert.equal(otp.normalizeEmail('  Foo@Gmail.COM '), 'foo@gmail.com');
  assert.equal(otp.normalizeEmail(null), '');
});

test('hashOtp — deterministic, sensitive to email + code, hex sha256', () => {
  const h = otp.hashOtp('a@b.com', '123456');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, otp.hashOtp('A@B.com', '123456'), 'email is normalized before hashing');
  assert.notEqual(h, otp.hashOtp('a@b.com', '123457'), 'different code → different hash');
  assert.notEqual(h, otp.hashOtp('x@b.com', '123456'), 'different email → different hash');
});

test('verifyOtp — accepts the right code, rejects everything else', () => {
  const code = '042042';
  const stored = otp.hashOtp('user@x.com', code);
  assert.equal(otp.verifyOtp('user@x.com', code, stored), true);
  assert.equal(otp.verifyOtp('USER@x.com', code, stored), true);     // case-insensitive
  assert.equal(otp.verifyOtp('user@x.com', '042043', stored), false); // wrong code
  assert.equal(otp.verifyOtp('user@x.com', '42042', stored), false);  // bad format
  assert.equal(otp.verifyOtp('user@x.com', code, ''), false);         // no stored hash
  assert.equal(otp.verifyOtp('other@x.com', code, stored), false);    // wrong email
});

test('isValidOtpFormat — exactly 6 digits', () => {
  assert.equal(otp.isValidOtpFormat('123456'), true);
  assert.equal(otp.isValidOtpFormat('000000'), true);
  assert.equal(otp.isValidOtpFormat('12345'), false);
  assert.equal(otp.isValidOtpFormat('1234567'), false);
  assert.equal(otp.isValidOtpFormat('12a456'), false);
  assert.equal(otp.isValidOtpFormat(''), false);
  assert.equal(otp.isValidOtpFormat(null), false);
});

test('passwordError — enforces length bounds', () => {
  assert.notEqual(otp.passwordError('12345'), '');      // too short
  assert.equal(otp.passwordError('123456'), '');         // ok
  assert.equal(otp.passwordError('a'.repeat(128)), '');  // max
  assert.notEqual(otp.passwordError('a'.repeat(129)), ''); // too long
  assert.notEqual(otp.passwordError(''), '');
});

test('isExpired — relative to now', () => {
  const now = 1_000_000;
  assert.equal(otp.isExpired(now + 1000, now), false);
  assert.equal(otp.isExpired(now - 1000, now), true);
  assert.equal(otp.isExpired(undefined, now), true);
  assert.equal(otp.isExpired(0, now), true);
});

test('newResetRecord — correct shape, expiry, and matching hash', () => {
  const now = 1_700_000_000_000;
  const code = '314159';
  const rec = otp.newResetRecord('  Test@Mail.com ', code, now);
  assert.equal(rec.email, 'test@mail.com');
  assert.equal(rec.attempts, 0);
  assert.equal(rec.sends, 1);
  assert.equal(rec.windowStart, now);
  assert.equal(rec.createdAt, now);
  assert.equal(rec.expiresAt, now + otp.OTP_TTL_MS);
  assert.equal(rec.otpHash, otp.hashOtp('test@mail.com', code));
  assert.ok(otp.verifyOtp('test@mail.com', code, rec.otpHash));
});

test('canSend — cooldown + per-window rate limiting', () => {
  const now = 1_700_000_000_000;
  // brand new → allow
  assert.equal(otp.canSend(null, now).allow, true);
  // just sent (within cooldown) → deny
  assert.equal(otp.canSend({ createdAt: now - 5000, windowStart: now - 5000, sends: 1 }, now).allow, false);
  // past cooldown, under cap → allow
  assert.equal(otp.canSend({ createdAt: now - 120000, windowStart: now - 120000, sends: 1 }, now).allow, true);
  // at the per-window cap → deny
  assert.equal(
    otp.canSend({ createdAt: now - 120000, windowStart: now - 600000, sends: otp.MAX_SENDS_PER_WINDOW }, now).allow,
    false,
  );
  // window expired → allow again even at old cap
  assert.equal(
    otp.canSend({ createdAt: now - otp.SEND_WINDOW_MS - 1, windowStart: now - otp.SEND_WINDOW_MS - 1, sends: 99 }, now).allow,
    true,
  );
});

test('accountAuthKind — classifies sign-in method from providerData', () => {
  assert.equal(otp.accountAuthKind([{ providerId: 'password' }]), 'password');
  assert.equal(otp.accountAuthKind([{ providerId: 'google.com' }]), 'google-only');
  // a Google user who later set a password counts as 'password' (normal reset)
  assert.equal(otp.accountAuthKind([{ providerId: 'google.com' }, { providerId: 'password' }]), 'password');
  assert.equal(otp.accountAuthKind([{ providerId: 'facebook.com' }]), 'other');
  assert.equal(otp.accountAuthKind([]), 'none');
  assert.equal(otp.accountAuthKind(undefined), 'none');
});

test('brute-force ceiling — 5 attempts against a 6-digit space is negligible', () => {
  // sanity: the security model is attempt-capped, not hash-strength
  assert.equal(otp.MAX_ATTEMPTS, 5);
  assert.equal(otp.OTP_TTL_MS, 10 * 60 * 1000);
});
