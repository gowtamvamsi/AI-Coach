// Pure helpers and injectable HTTP handler for the course enquiry endpoint.
// No Firebase here — unit-testable in isolation (see tests/course-enquiry.test.mjs).
const crypto = require('crypto');

const MAX_BODY_BYTES = 8192;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const RECAPTCHA_MIN_SCORE = 0.5;
const RECAPTCHA_ACTION = 'course_enquiry';
const ALLOWED_FIELDS = new Set([
  'name', 'email', 'phone', 'occupation', 'message', 'recaptchaToken',
]);
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const PRODUCTION_ORIGINS = new Set([
  'https://balajichippada.com',
  'https://www.balajichippada.com',
]);

const LOCALHOST_ORIGIN = /^http:\/\/localhost:\d+$/;
const LOOPBACK_ORIGIN = /^http:\/\/127\.0\.0\.1:\d+$/;

const GENERIC_ERROR_MESSAGE = 'We couldn\u2019t submit your request. Please try again.';

function hasUnknownFields(body) {
  return Object.keys(body || {}).some((key) => !ALLOWED_FIELDS.has(key));
}

function countDigits(value) {
  return String(value).replace(/\D/g, '').length;
}

function normalizePayload(body) {
  const input = body && typeof body === 'object' ? body : {};

  if (hasUnknownFields(input)) {
    return { ok: false, errors: { form: 'unknown fields' } };
  }

  const errors = {};
  const name = String(input.name ?? '').trim();
  const email = String(input.email ?? '').trim().toLowerCase();
  const phone = String(input.phone ?? '').trim();
  const occupation = String(input.occupation ?? '').trim();
  const message = String(input.message ?? '').trim();
  const recaptchaToken = String(input.recaptchaToken ?? '').trim();

  if (name.length < 2 || name.length > 80) errors.name = 'invalid';
  if (email.length < 3 || email.length > 254 || !EMAIL_RE.test(email)) errors.email = 'invalid';
  if (phone.length === 0 || phone.length > 32) {
    errors.phone = 'invalid';
  } else {
    const digits = countDigits(phone);
    if (digits < 7 || digits > 15) errors.phone = 'invalid';
  }
  if (occupation.length > 80) errors.occupation = 'invalid';
  if (message.length > 1000) errors.message = 'invalid';
  if (!recaptchaToken || recaptchaToken.length > 4096) errors.recaptchaToken = 'invalid';

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      lead: {
        name,
        email,
        phone,
        occupation,
        message,
        source: 'course_enquiry',
      },
      recaptchaToken,
    },
  };
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (PRODUCTION_ORIGINS.has(origin)) return true;
  if (LOCALHOST_ORIGIN.test(origin)) return true;
  if (LOOPBACK_ORIGIN.test(origin)) return true;
  return false;
}

function getClientIp(req) {
  const forwarded = req && req.headers && req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    if (first) return first;
  }
  if (req && req.ip) return String(req.ip);
  return '';
}

function hashLimitKey(kind, value, secret) {
  return crypto.createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex');
}

function rateDecision(existing, nowMs) {
  if (!existing || nowMs - existing.windowStart >= RATE_WINDOW_MS) {
    return {
      allow: true,
      next: { windowStart: nowMs, count: 1, updatedAt: nowMs },
    };
  }

  if (existing.count >= RATE_MAX) {
    return { allow: false, next: existing };
  }

  return {
    allow: true,
    next: {
      windowStart: existing.windowStart,
      count: existing.count + 1,
      updatedAt: nowMs,
    },
  };
}

function isDuplicate(existing, nowMs) {
  if (!existing || existing.lastSubmittedAt == null) return false;
  return nowMs - existing.lastSubmittedAt < DUPLICATE_WINDOW_MS;
}

function createHandler({ verifyRecaptcha, submitLead, hashSecret, now }) {
  return async function courseEnquiryHandler(req, res) {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ ok: false });
      }

      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      if (!contentType.includes('application/json')) {
        return res.status(415).json({ ok: false });
      }

      if (req.rawBody && req.rawBody.length > MAX_BODY_BYTES) {
        return res.status(413).json({ ok: false });
      }

      const origin = req.headers.origin || req.headers.Origin;
      if (!isAllowedOrigin(origin)) {
        return res.status(403).json({ ok: false });
      }

      const normalized = normalizePayload(req.body);
      if (!normalized.ok) {
        return res.status(400).json({ ok: false });
      }

      const ip = getClientIp(req);
      const verifyResult = await verifyRecaptcha({
        token: normalized.value.recaptchaToken,
        remoteIp: ip,
        expectedAction: RECAPTCHA_ACTION,
        minScore: RECAPTCHA_MIN_SCORE,
      });
      if (!verifyResult.ok) {
        return res.status(403).json({ ok: false });
      }

      const nowMs = now();
      const submitResult = await submitLead({
        lead: normalized.value.lead,
        ip,
        nowMs,
      });

      if (!submitResult.ok) {
        if (submitResult.reason === 'config') {
          return res.status(503).json({ ok: false });
        }
        if (submitResult.reason === 'rate' || submitResult.reason === 'duplicate') {
          return res.status(429).json({ ok: false });
        }
        return res.status(500).json({
          ok: false,
          message: GENERIC_ERROR_MESSAGE,
        });
      }

      return res.status(200).json({ ok: true });
    } catch (_err) {
      return res.status(500).json({
        ok: false,
        message: GENERIC_ERROR_MESSAGE,
      });
    }
  };
}

module.exports = {
  MAX_BODY_BYTES,
  RATE_WINDOW_MS,
  RATE_MAX,
  DUPLICATE_WINDOW_MS,
  RECAPTCHA_MIN_SCORE,
  RECAPTCHA_ACTION,
  ALLOWED_FIELDS,
  normalizePayload,
  isAllowedOrigin,
  getClientIp,
  hashLimitKey,
  rateDecision,
  isDuplicate,
  createHandler,
};
