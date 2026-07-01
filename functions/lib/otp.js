// Pure, dependency-light helpers for the OTP password-reset flow.
// No Firebase here — so this is unit-testable in isolation (see tests/otp.test.mjs).
const crypto = require('crypto');

const OTP_TTL_MS = 10 * 60 * 1000;        // codes valid for 10 minutes
const MAX_ATTEMPTS = 5;                    // wrong-code tries before the record is burned
const RESEND_COOLDOWN_MS = 60 * 1000;      // min gap between sends for one email
const MAX_SENDS_PER_WINDOW = 5;            // sends per email per window (anti email-bomb)
const SEND_WINDOW_MS = 60 * 60 * 1000;     // 1 hour
const MIN_PASSWORD_LEN = 6;                // Firebase Auth minimum
const MAX_PASSWORD_LEN = 128;

// 6-digit, cryptographically-random, zero-padded ("000000".."999999").
function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function normalizeEmail(email) {
  return String(email == null ? '' : email).trim().toLowerCase();
}

// We store only a hash of the code, never the raw OTP (so it never sits in
// plaintext in the DB, backups, or logs).
function hashOtp(email, otp) {
  return crypto.createHash('sha256').update(`${normalizeEmail(email)}:${String(otp)}`).digest('hex');
}

// Constant-time comparison to avoid leaking match progress via timing.
function verifyOtp(email, otp, storedHash) {
  if (!storedHash || !isValidOtpFormat(otp)) return false;
  const a = Buffer.from(hashOtp(email, String(otp)), 'utf8');
  const b = Buffer.from(String(storedHash), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isValidOtpFormat(otp) {
  return /^\d{6}$/.test(String(otp == null ? '' : otp));
}

// '' when acceptable, else a human message.
function passwordError(pw) {
  const s = String(pw == null ? '' : pw);
  if (s.length < MIN_PASSWORD_LEN) return `Password must be at least ${MIN_PASSWORD_LEN} characters.`;
  if (s.length > MAX_PASSWORD_LEN) return 'Password is too long.';
  return '';
}

function isExpired(expiresAtMs, nowMs = Date.now()) {
  return !expiresAtMs || nowMs > expiresAtMs;
}

// Build the Firestore reset record for a freshly-issued code.
function newResetRecord(email, otp, nowMs = Date.now()) {
  return {
    email: normalizeEmail(email),
    otpHash: hashOtp(email, otp),
    expiresAt: nowMs + OTP_TTL_MS,
    attempts: 0,
    createdAt: nowMs,
    sends: 1,
    windowStart: nowMs,
  };
}

// Decide whether a new send is allowed given the existing record (or null).
// Returns { allow, reason }. Callers should NOT reveal the reason to the client
// (anti-enumeration) — it's for server logic/logging only.
function canSend(existing, nowMs = Date.now()) {
  if (!existing) return { allow: true, reason: 'new' };
  if (existing.createdAt && nowMs - existing.createdAt < RESEND_COOLDOWN_MS) {
    return { allow: false, reason: 'cooldown' };
  }
  const inWindow = existing.windowStart && nowMs - existing.windowStart < SEND_WINDOW_MS;
  if (inWindow && (existing.sends || 0) >= MAX_SENDS_PER_WINDOW) {
    return { allow: false, reason: 'rate-limited' };
  }
  return { allow: true, reason: 'ok' };
}

// Classify how an account signs in, from its Firebase providerData.
//   'password'    → has email/password (normal reset applies)
//   'google-only' → Google sign-in, no password set (no password to "reset")
//   'other'/'none'
function accountAuthKind(providerData) {
  const ids = (providerData || []).map((p) => p && p.providerId);
  if (ids.includes('password')) return 'password';
  if (ids.includes('google.com')) return 'google-only';
  return ids.length ? 'other' : 'none';
}

module.exports = {
  OTP_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS, MAX_SENDS_PER_WINDOW, SEND_WINDOW_MS,
  MIN_PASSWORD_LEN, MAX_PASSWORD_LEN,
  generateOtp, normalizeEmail, hashOtp, verifyOtp, isValidOtpFormat, passwordError,
  isExpired, newResetRecord, canSend, accountAuthKind,
};
