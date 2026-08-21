// Loads the REAL shipped browser bundles (site.config.js, phone-countries.js,
// data.js, videos.js, v2.build.js) into a Node vm sandbox with minimal browser stubs, then returns
// the sandbox so tests can call the actual production functions (V2_VALIDATE,
// getMcPrice, formatMc*, ROADMAP, ROADMAP_VIDEOS, …).
//
// Why this works: these files are classic scripts that attach top-level
// functions + `window.X = X` assignments to the global scope. None of them
// self-mount React (v2.build.js has no createRoot), and all DOM/event work is
// inside function bodies that only run when called — so loading is side-effect
// free. We never touch Firebase, the network, or any production service.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadSiteGlobals() {
  // A universal no-op: callable, constructable, any property returns itself.
  // Stands in for browser APIs we don't exercise at load time (document, React…).
  const noop = new Proxy(function () { return noop; }, {
    get: () => noop,
    apply: () => noop,
    construct: () => noop,
  });

  const sandbox = {};
  sandbox.window = sandbox;          // window === global, like a real browser
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.console = console;
  sandbox.location = { hostname: 'test.local', href: 'https://test.local/', search: '', origin: 'https://test.local' };
  sandbox.navigator = { userAgent: 'node-test', platform: 'node-test' };
  sandbox.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
  sandbox.sessionStorage = sandbox.localStorage;
  sandbox.fetch = () => Promise.resolve({ ok: false, status: 0, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
  sandbox.document = noop;
  sandbox.React = noop;
  sandbox.ReactDOM = noop;
  sandbox.IntersectionObserver = function () { return { observe() {}, disconnect() {}, unobserve() {} }; };
  sandbox.MutationObserver = sandbox.IntersectionObserver;
  sandbox.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  sandbox.cancelAnimationFrame = () => {};
  sandbox.setTimeout = setTimeout;
  sandbox.clearTimeout = clearTimeout;
  sandbox.setInterval = setInterval;
  sandbox.clearInterval = clearInterval;
  sandbox.URLSearchParams = URLSearchParams;
  sandbox.FIREBASE_CONFIG = { projectId: 'test' };
  sandbox.firebase = noop;

  vm.createContext(sandbox);
  for (const f of ['site.config.js', 'phone-countries.js', 'data.js', 'videos.js', 'v2.build.js']) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    vm.runInContext(code, sandbox, { filename: f });
  }
  return sandbox;
}

export const ROOT_DIR = ROOT;
