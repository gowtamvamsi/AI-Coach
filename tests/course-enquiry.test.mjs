// Unit tests for course enquiry server contract (functions/lib/course-enquiry.js).
// Pure functions + injectable HTTP handler — no Firebase, no network.
// Run: node --test tests/course-enquiry.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(repoRoot, 'functions/index.js'), 'utf8');
const firebaseJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'firebase.json'), 'utf8'));

const require = createRequire(import.meta.url);
const enquiry = require('../functions/lib/course-enquiry.js');

test('normalizePayload — returns the exact stored lead shape', () => {
  const result = enquiry.normalizePayload({
    name: '  Asha Rao  ',
    email: ' ASHA@EXAMPLE.COM ',
    phone: ' +91 98765 43210 ',
    occupation: 'Student',
    message: '  Please call after 6 PM.  ',
    recaptchaToken: 'token',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.lead, {
    name: 'Asha Rao',
    email: 'asha@example.com',
    phone: '+91 98765 43210',
    occupation: 'Student',
    message: 'Please call after 6 PM.',
    source: 'course_enquiry',
  });
  assert.equal(result.value.recaptchaToken, 'token');
});

test('normalizePayload — requires name, email, phone, and token', () => {
  const result = enquiry.normalizePayload({});
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['email', 'name', 'phone', 'recaptchaToken']);
});

test('normalizePayload — rejects unknown and oversized fields', () => {
  assert.equal(enquiry.normalizePayload({
    name: 'Asha Rao',
    email: 'asha@example.com',
    phone: '+919876543210',
    occupation: '',
    message: '',
    recaptchaToken: 'token',
    role: 'admin',
  }).ok, false);
  assert.equal(enquiry.normalizePayload({
    name: 'Asha Rao',
    email: 'asha@example.com',
    phone: '+919876543210',
    occupation: '',
    message: 'x'.repeat(1001),
    recaptchaToken: 'token',
  }).ok, false);
});

test('normalizePayload — rejects malformed email addresses', () => {
  for (const email of ['not-an-email', 'a@b', '@example.com', 'user@.com']) {
    const result = enquiry.normalizePayload({
      name: 'Asha Rao',
      email,
      phone: '+919876543210',
      occupation: '',
      message: '',
      recaptchaToken: 'token',
    });
    assert.equal(result.ok, false, `expected "${email}" to be rejected`);
    assert.equal(result.errors.email, 'invalid');
  }
});

test('rateDecision — allows five requests and resets after one hour', () => {
  const now = 1_700_000_000_000;
  assert.deepEqual(enquiry.rateDecision(null, now), {
    allow: true,
    next: { windowStart: now, count: 1, updatedAt: now },
  });
  assert.equal(enquiry.rateDecision({ windowStart: now - 1000, count: 5 }, now).allow, false);
  assert.equal(enquiry.rateDecision({
    windowStart: now - enquiry.RATE_WINDOW_MS - 1,
    count: 99,
  }, now).allow, true);
});

test('isDuplicate — blocks the same lead for ten minutes', () => {
  const now = 1_700_000_000_000;
  assert.equal(enquiry.isDuplicate(null, now), false);
  assert.equal(enquiry.isDuplicate({ lastSubmittedAt: now - 1000 }, now), true);
  assert.equal(enquiry.isDuplicate({
    lastSubmittedAt: now - enquiry.DUPLICATE_WINDOW_MS - 1,
  }, now), false);
});

test('isAllowedOrigin — accepts localhost and loopback dev origins with explicit ports', () => {
  assert.equal(enquiry.isAllowedOrigin('http://localhost:3000'), true);
  assert.equal(enquiry.isAllowedOrigin('http://127.0.0.1:8080'), true);
});

test('isAllowedOrigin — rejects bare localhost, https localhost, and trailing-path variants', () => {
  assert.equal(enquiry.isAllowedOrigin('http://localhost'), false);
  assert.equal(enquiry.isAllowedOrigin('https://localhost:3000'), false);
  assert.equal(enquiry.isAllowedOrigin('http://localhost:3000/'), false);
  assert.equal(enquiry.isAllowedOrigin('http://localhost:3000/path'), false);
  assert.equal(enquiry.isAllowedOrigin('http://127.0.0.1:8080/'), false);
});

test('getClientIp — prefers the first x-forwarded-for value, then req.ip, then empty string', () => {
  assert.equal(enquiry.getClientIp({
    headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.10' },
    ip: '203.0.113.10',
  }), '198.51.100.1');
  assert.equal(enquiry.getClientIp({
    headers: { 'x-forwarded-for': ' 198.51.100.2 , 203.0.113.10 ' },
    ip: '203.0.113.10',
  }), '198.51.100.2');
  assert.equal(enquiry.getClientIp({ headers: {}, ip: '203.0.113.10' }), '203.0.113.10');
  assert.equal(enquiry.getClientIp({ headers: {} }), '');
});

test('hashLimitKey — returns deterministic HMAC-SHA256 hex and varies by kind', () => {
  const kind = 'ip';
  const value = '203.0.113.10';
  const secret = 'test-rate-secret';
  const expected = crypto.createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex');
  assert.equal(enquiry.hashLimitKey(kind, value, secret), expected);
  assert.notEqual(enquiry.hashLimitKey('email', value, secret), expected);
});

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function createTestHandler(overrides = {}) {
  return enquiry.createHandler({
    verifyRecaptcha: async ({ token, remoteIp, expectedAction, minScore }) => ({
      ok: token === 'good-token' &&
        expectedAction === 'course_enquiry' &&
        minScore === 0.5,
    }),
    submitLead: async () => ({ ok: true }),
    hashSecret: 'test-rate-secret',
    now: () => 1_700_000_000_000,
    ...overrides,
  });
}

const validBody = {
  name: 'Asha Rao',
  email: 'asha@example.com',
  phone: '+919876543210',
  occupation: '',
  message: '',
  recaptchaToken: 'good-token',
};

function baseReq(overrides = {}) {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://balajichippada.com',
    },
    body: validBody,
    rawBody: Buffer.from(JSON.stringify(validBody)),
    ip: '203.0.113.10',
    ...overrides,
  };
}

test('createHandler — returns 405 for non-POST', async () => {
  const handler = createTestHandler();
  const res = mockRes();
  await handler(baseReq({ method: 'GET' }), res);
  assert.equal(res.statusCode, 405);
  assert.deepEqual(res.body, { ok: false });
});

test('createHandler — returns 415 for non-JSON', async () => {
  const handler = createTestHandler();
  const res = mockRes();
  await handler(baseReq({ headers: { origin: 'https://balajichippada.com' } }), res);
  assert.equal(res.statusCode, 415);
  assert.deepEqual(res.body, { ok: false });
});

test('createHandler — returns 413 when rawBody exceeds 8192 bytes', async () => {
  const handler = createTestHandler();
  const res = mockRes();
  await handler(baseReq({ rawBody: Buffer.alloc(8193) }), res);
  assert.equal(res.statusCode, 413);
  assert.deepEqual(res.body, { ok: false });
});

test('createHandler — returns 403 for absent or disallowed origin', async () => {
  const handler = createTestHandler();
  const noOrigin = mockRes();
  await handler(baseReq({ headers: { 'content-type': 'application/json' } }), noOrigin);
  assert.equal(noOrigin.statusCode, 403);

  const badOrigin = mockRes();
  await handler(baseReq({
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
  }), badOrigin);
  assert.equal(badOrigin.statusCode, 403);
});

test('createHandler — returns 400 for invalid fields', async () => {
  const handler = createTestHandler();
  const res = mockRes();
  await handler(baseReq({ body: { recaptchaToken: 'good-token' } }), res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { ok: false });
});

test('createHandler — returns 403 for rejected reCAPTCHA', async () => {
  const handler = createTestHandler();
  const res = mockRes();
  await handler(baseReq({ body: { ...validBody, recaptchaToken: 'bad-token' } }), res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { ok: false });
});

test('createHandler — returns 429 for rate or duplicate rejection', async () => {
  const rateHandler = createTestHandler({
    submitLead: async () => ({ ok: false, reason: 'rate' }),
  });
  const rateRes = mockRes();
  await rateHandler(baseReq(), rateRes);
  assert.equal(rateRes.statusCode, 429);
  assert.deepEqual(rateRes.body, { ok: false });

  const dupHandler = createTestHandler({
    submitLead: async () => ({ ok: false, reason: 'duplicate' }),
  });
  const dupRes = mockRes();
  await dupHandler(baseReq(), dupRes);
  assert.equal(dupRes.statusCode, 429);
  assert.deepEqual(dupRes.body, { ok: false });
});

test('createHandler — returns 503 for submitLead config rejection', async () => {
  const handler = createTestHandler({
    submitLead: async () => ({ ok: false, reason: 'config' }),
  });
  const res = mockRes();
  await handler(baseReq(), res);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { ok: false });
});

test('createHandler — passes the first x-forwarded-for IP to verifyRecaptcha and submitLead', async () => {
  let recaptchaIp = null;
  let submitIp = null;
  const handler = createTestHandler({
    verifyRecaptcha: async ({ token, remoteIp, expectedAction, minScore }) => {
      recaptchaIp = remoteIp;
      return {
        ok: token === 'good-token' &&
          expectedAction === 'course_enquiry' &&
          minScore === 0.5,
      };
    },
    submitLead: async ({ ip }) => {
      submitIp = ip;
      return { ok: true };
    },
  });
  const res = mockRes();
  await handler(baseReq({
    headers: {
      'content-type': 'application/json',
      origin: 'https://balajichippada.com',
      'x-forwarded-for': '198.51.100.1, 203.0.113.10',
    },
    ip: '203.0.113.10',
  }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(recaptchaIp, '198.51.100.1');
  assert.equal(submitIp, '198.51.100.1');
});

test('createHandler — returns 200 only after submitLead succeeds', async () => {
  let submitted = false;
  const handler = createTestHandler({
    submitLead: async ({ lead, ip, nowMs }) => {
      submitted = true;
      assert.deepEqual(lead, {
        name: 'Asha Rao',
        email: 'asha@example.com',
        phone: '+919876543210',
        occupation: '',
        message: '',
        source: 'course_enquiry',
      });
      assert.equal(ip, '203.0.113.10');
      assert.equal(nowMs, 1_700_000_000_000);
      return { ok: true };
    },
  });
  const res = mockRes();
  await handler(baseReq(), res);
  assert.equal(submitted, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
});

test('createHandler — returns 500 with a generic message and no leaked exception text', async () => {
  const failHandler = createTestHandler({
    submitLead: async () => ({ ok: false, reason: 'firestore-down' }),
  });
  const failRes = mockRes();
  await failHandler(baseReq(), failRes);
  assert.equal(failRes.statusCode, 500);
  assert.deepEqual(failRes.body, {
    ok: false,
    message: 'We couldn\u2019t submit your request. Please try again.',
  });
  assert.equal(JSON.stringify(failRes.body).includes('firestore-down'), false);

  const throwHandler = createTestHandler({
    submitLead: async () => {
      throw new Error('super-secret-db-password');
    },
  });
  const throwRes = mockRes();
  await throwHandler(baseReq(), throwRes);
  assert.equal(throwRes.statusCode, 500);
  assert.deepEqual(throwRes.body, {
    ok: false,
    message: 'We couldn\u2019t submit your request. Please try again.',
  });
  assert.equal(JSON.stringify(throwRes.body).includes('super-secret-db-password'), false);
});

test('index.js source contract — wires course enquiry lib, export, timestamp, and one transaction', () => {
  assert.match(indexSource, /require\s*\(\s*["']\.\/lib\/course-enquiry["']\s*\)/);
  assert.match(indexSource, /exports\.courseEnquiry\s*=\s*functions\.https\.onRequest/);
  assert.match(indexSource, /admin\.firestore\.FieldValue\.serverTimestamp\(\)/);
  assert.match(indexSource, /\.runTransaction\s*\(/);
  assert.match(indexSource, /courseEnquiryLimits/);
  assert.match(indexSource, /ip_/);
  assert.match(indexSource, /email_/);
  assert.match(indexSource, /duplicate_/);
  assert.match(indexSource, /collection\s*\(\s*["']leads["']\s*\)/);
});

test('index.js source contract — production createHandler passes now: () => Date.now()', () => {
  assert.match(
    indexSource,
    /createHandler\s*\(\s*\{[\s\S]*now\s*:\s*\(\)\s*=>\s*Date\.now\(\)/,
  );
});

test('firebase.json source contract — rewrites /api/course-enquiry before the SPA catch-all', () => {
  const rewrites = firebaseJson.hosting.rewrites;
  const courseIdx = rewrites.findIndex((r) => r.source === '/api/course-enquiry');
  const catchAllIdx = rewrites.findIndex((r) => r.source === '**');
  assert.notEqual(courseIdx, -1, 'missing /api/course-enquiry rewrite');
  assert.notEqual(catchAllIdx, -1, 'missing ** rewrite');
  assert.ok(courseIdx < catchAllIdx, '/api/course-enquiry must appear before **');
  assert.equal(rewrites[courseIdx].function, 'courseEnquiry');
});

test('firestore.rules source contract — blocks anonymous course_enquiry client writes', () => {
  const rulesSource = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  assert.match(rulesSource, /request\.resource\.data\.source\s*!=\s*['"]course_enquiry['"]/);
});

test('courseEnquiry export — returns 503 before validating user data when secrets are missing', async () => {
  const savedRecaptcha = process.env.RECAPTCHA_SECRET_KEY;
  const savedHash = process.env.COURSE_ENQUIRY_HASH_SECRET;
  delete process.env.RECAPTCHA_SECRET_KEY;
  delete process.env.COURSE_ENQUIRY_HASH_SECRET;

  try {
    const indexPath = path.join(repoRoot, 'functions/index.js');
    delete require.cache[require.resolve(indexPath)];
    const indexModule = require(indexPath);
    const handler = indexModule.courseEnquiry;
    assert.equal(typeof handler, 'function');

    const res = mockRes();
    await handler({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://balajichippada.com',
      },
      body: validBody,
      rawBody: Buffer.from(JSON.stringify(validBody)),
      ip: '203.0.113.10',
    }, res);

    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { ok: false });
  } finally {
    if (savedRecaptcha === undefined) delete process.env.RECAPTCHA_SECRET_KEY;
    else process.env.RECAPTCHA_SECRET_KEY = savedRecaptcha;
    if (savedHash === undefined) delete process.env.COURSE_ENQUIRY_HASH_SECRET;
    else process.env.COURSE_ENQUIRY_HASH_SECRET = savedHash;
  }
});
