/**
 * In-Memory Mock Test Runner for Lead captures and Drip Campaigns.
 * This script runs the triggers and scheduled logic directly in-memory, 
 * bypassing the need for a running Java emulator environment.
 * 
 * Usage:
 *   node scripts/test-drips-mock.js
 */

console.log("==================================================================");
console.log("   STARTING IN-MEMORY WELCOME DRIP AUTOMATION TEST (NO EMULATOR)  ");
console.log("==================================================================");

// --- 1. SET UP IN-MEMORY FIRESTORE & FIREBASE ADMIN MOCK ---
process.env.FUNCTIONS_EMULATOR = "true";
const dbStore = {};

class MockDocRef {
  constructor(collectionName, docId) {
    this.collectionName = collectionName;
    this.id = docId;
  }

  async get() {
    const data = dbStore[this.collectionName]?.[this.id] || null;
    return {
      exists: data !== null,
      data: () => data,
      ref: this
    };
  }

  async set(data) {
    if (!dbStore[this.collectionName]) dbStore[this.collectionName] = {};
    dbStore[this.collectionName][this.id] = Object.assign({}, data);
    return this;
  }

  async update(data) {
    if (!dbStore[this.collectionName]?.[this.id]) {
      throw new Error(`Doc ${this.id} not found in collection ${this.collectionName}`);
    }
    Object.assign(dbStore[this.collectionName][this.id], data);
    return this;
  }
}

class MockQuery {
  constructor(collectionName, filters = []) {
    this.collectionName = collectionName;
    this.filters = filters;
  }

  where(field, op, value) {
    return new MockQuery(this.collectionName, [...this.filters, { field, op, value }]);
  }

  limit(n) {
    this.limitVal = n;
    return this;
  }

  async get() {
    const docs = [];
    const colData = dbStore[this.collectionName] || {};
    
    for (const [id, val] of Object.entries(colData)) {
      let match = true;
      for (const filter of this.filters) {
        const docVal = val[filter.field];
        if (filter.op === "==" && docVal !== filter.value) match = false;
        if (filter.op === "<=") {
          // Compare dates or timestamps
          const timeA = docVal && typeof docVal.toDate === 'function' ? docVal.toDate() : docVal;
          const timeB = filter.value && typeof filter.value.toDate === 'function' ? filter.value.toDate() : filter.value;
          if (!(timeA <= timeB)) match = false;
        }
      }
      if (match) {
        docs.push({
          id,
          ref: new MockDocRef(this.collectionName, id),
          data: () => val
        });
      }
    }

    const sliced = this.limitVal ? docs.slice(0, this.limitVal) : docs;
    return {
      empty: sliced.length === 0,
      docs: sliced,
      forEach: (cb) => sliced.forEach(cb)
    };
  }
}

class MockCollectionRef extends MockQuery {
  doc(docId) {
    const id = docId || Math.random().toString(36).substring(7);
    return new MockDocRef(this.collectionName, id);
  }

  async add(data) {
    const id = Math.random().toString(36).substring(7);
    const ref = new MockDocRef(this.collectionName, id);
    await ref.set(data);
    return ref;
  }
}

// Intercept modules
const Module = require('module');
const originalRequire = Module.prototype.require;

const mockFirebaseAdmin = {
  initializeApp: () => console.log("[Mock Admin] Initialized App"),
  firestore: () => ({
    collection: (name) => new MockCollectionRef(name),
    batch: () => ({
      delete: (ref) => {
        delete dbStore[ref.collectionName]?.[ref.id];
      },
      commit: async () => {}
    })
  })
};

// Add serverTimestamp and fromDate helper representations
mockFirebaseAdmin.firestore.FieldValue = {
  serverTimestamp: () => ({ _type: 'serverTimestamp', toDate: () => new Date() })
};
mockFirebaseAdmin.firestore.Timestamp = {
  now: () => ({ toDate: () => new Date() }),
  fromDate: (date) => ({ toDate: () => date })
};

// Mock functions triggers registrar
const registeredTriggers = {};
const mockFirebaseFunctions = {
  firestore: {
    document: (path) => ({
      onCreate: (handler) => {
        registeredTriggers.onCreate = handler;
        return handler;
      },
      onUpdate: (handler) => {
        registeredTriggers.onUpdate = handler;
        return handler;
      }
    })
  },
  https: {
    onCall: (handler) => {
      registeredTriggers.onCall = handler;
      return handler;
    },
    onRequest: (handler) => {
      registeredTriggers.onRequest = handler;
      return handler;
    },
    HttpsError: class HttpsError extends Error {
      constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
      }
    }
  },
  pubsub: {
    schedule: (scheduleStr) => ({
      onRun: (handler) => {
        registeredTriggers.onRun = handler;
        return handler;
      }
    })
  }
};

Module.prototype.require = function (id) {
  if (id === 'firebase-admin') return mockFirebaseAdmin;
  if (id === 'firebase-functions') return mockFirebaseFunctions;
  return originalRequire.apply(this, arguments);
};

// --- 2. REQUIRE FUNCTIONS INDEX.JS TO REGISTER HANDLERS ---
console.log("2. Loading functions/index.js and registering triggers...");
require("../functions/index.js");

// --- 3. RUN MOCK TESTS ---
async function runMockTest() {
  console.log("\n3. Seeding in-memory Firestore with leads...");
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25h old
  const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000); // 4 days old

  const colLeads = new MockCollectionRef("leads");

  // Lead A: Fresh signup
  const leadRefA = colLeads.doc("lead_fresh_test");
  await leadRefA.set({
    name: "Fresh Lead (A)",
    email: "fresh_lead@example.com",
    source: "roadmap_teaser",
    createdAt: mockFirebaseAdmin.firestore.Timestamp.fromDate(now)
  });

  // Lead B: 25 hours old
  const leadRefB = colLeads.doc("lead_oneday_test");
  await leadRefB.set({
    name: "One-Day Lead (B)",
    email: "oneday_lead@example.com",
    source: "phase_materials_1",
    createdAt: mockFirebaseAdmin.firestore.Timestamp.fromDate(oneDayAgo)
  });

  // Lead C: 4 days old
  const leadRefC = colLeads.doc("lead_fourday_test");
  await leadRefC.set({
    name: "Four-Day Lead (C)",
    email: "fourday_lead@example.com",
    source: "roadmap_hero_cta",
    createdAt: mockFirebaseAdmin.firestore.Timestamp.fromDate(fourDaysAgo)
  });

  console.log("   [+] Seeded Lead A (Fresh signup)");
  console.log("   [+] Seeded Lead B (25 hours old)");
  console.log("   [+] Seeded Lead C (4 days old)");

  // Trigger onLeadCreated for Lead A manually to test immediate welcome email
  console.log("\n4. Simulating onCreate Trigger for Lead A...");
  const snapA = await leadRefA.get();
  await registeredTriggers.onCreate(snapA, { params: { leadId: "lead_fresh_test" } });

  // Trigger Drip campaigns
  console.log("\n5. Executing processDripCampaign Callable function logic in-memory...");
  // Directly trigger the callable handler (which runs processDrips internally)
  const result = await registeredTriggers.onCall({}, { auth: { uid: "admin_uid" } });
  console.log("   [✓] Drip execution stats:", result.stats);

  // Retrieve states
  const updatedA = await leadRefA.get();
  const updatedB = await leadRefB.get();
  const updatedC = await leadRefC.get();

  console.log("\n------------------------------------------------");
  console.log("Fresh Lead (A) State (Expected: welcomeEmailSent = true, others false):");
  console.log(`  - welcomeEmailSent: ${updatedA.data().welcomeEmailSent}`);
  console.log(`  - gettingStartedEmailSent: ${updatedA.data().gettingStartedEmailSent || false}`);
  console.log(`  - inviteEmailSent: ${updatedA.data().inviteEmailSent || false}`);

  console.log("\nOne-Day Lead (B) State (Expected: welcomeEmailSent = true, gettingStartedEmailSent = true, inviteEmailSent = false):");
  console.log(`  - welcomeEmailSent: ${updatedB.data().welcomeEmailSent || false}`);
  console.log(`  - gettingStartedEmailSent: ${updatedB.data().gettingStartedEmailSent || false}`);
  console.log(`  - inviteEmailSent: ${updatedB.data().inviteEmailSent || false}`);

  console.log("\nFour-Day Lead (C) State (Expected: welcomeEmailSent = true, gettingStartedEmailSent = true, inviteEmailSent = true):");
  console.log(`  - welcomeEmailSent: ${updatedC.data().welcomeEmailSent || false}`);
  console.log(`  - gettingStartedEmailSent: ${updatedC.data().gettingStartedEmailSent || false}`);
  console.log(`  - inviteEmailSent: ${updatedC.data().inviteEmailSent || false}`);
  console.log("------------------------------------------------\n");

  const success = updatedA.data().welcomeEmailSent &&
    updatedB.data().gettingStartedEmailSent &&
    updatedC.data().gettingStartedEmailSent &&
    updatedC.data().inviteEmailSent &&
    !updatedA.data().gettingStartedEmailSent &&
    !updatedB.data().inviteEmailSent;

  if (success) {
    console.log("==================================================================");
    console.log("   [✓] IN-MEMORY WELCOME DRIP AUTOMATION TEST COMPLETED SUCCESSFULLY! ");
    console.log("==================================================================");
  } else {
    console.error("   [X] TEST FAILED: Document states do not match expected outcomes.");
  }
}

runMockTest().catch(console.error);
