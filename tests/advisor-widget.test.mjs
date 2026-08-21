// Browser contract tests for the shared advisor widget (advisor-widget.js).
// Run: node --test tests/advisor-widget.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDGET_PATH = path.join(ROOT, 'advisor-widget.js');
const COUNTRIES_PATH = path.join(ROOT, 'phone-countries.js');
const STYLES_PATH = path.join(ROOT, 'styles.css');

let browser;

before(async () => {
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
});

after(async () => {
  await browser?.close();
});

async function loadWidgetPage(page, options = {}) {
  const width = options.width ?? 1024;
  await page.setViewport({ width, height: 768 });
  if (options.pathname) {
    const html = `<!DOCTYPE html><html><body><button id="trigger">Open</button></body></html>`;
    const onRequest = (req) => {
      req.respond({ status: 200, contentType: 'text/html', body: html });
    };
    await page.setRequestInterception(true);
    page.on('request', onRequest);
    await page.goto(`https://balajichippada.com${options.pathname}`, { waitUntil: 'domcontentloaded' });
    page.off('request', onRequest);
    await page.setRequestInterception(false);
  } else {
    await page.setContent(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <button id="trigger">Open</button>
      </body>
    </html>
  `);
  }

  await page.addStyleTag({ path: STYLES_PATH });
  await page.evaluate((languages) => {
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      get: () => languages,
    });
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      get: () => languages[0] || '',
    });
  }, options.languages ?? ['hi-IN']);
  await page.evaluate((siteConfig) => {
    window.SITE_CONFIG = siteConfig;
    window.grecaptcha = {
      ready: (cb) => cb(),
      execute: async () => 'test-token',
    };
    window.__fetchCalls = [];
    window.__grecaptchaCalls = [];
    const realExecute = window.grecaptcha.execute.bind(window.grecaptcha);
    window.grecaptcha.execute = async (...args) => {
      window.__grecaptchaCalls.push(args);
      return realExecute(...args);
    };
    window.fetch = async (url, init) => {
      window.__fetchCalls.push({ url, init });
      if (window.__fetchImpl) return window.__fetchImpl(url, init);
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    };
  }, {
    brand: { whatsappCommunity: options.whatsappUrl ?? 'https://example.com/whatsapp' },
    contact: { recaptchaSiteKey: options.recaptchaSiteKey ?? 'test-site-key' },
  });

  await page.addScriptTag({ path: COUNTRIES_PATH });
  await page.addScriptTag({ path: WIDGET_PATH });
  await page.waitForFunction(() => window.AdvisorWidget);
}

async function newPage(options = {}) {
  const page = await browser.newPage();
  await loadWidgetPage(page, options);
  return page;
}

test('init creates exactly one sticky control', async () => {
  const page = await newPage();
  const count = await page.$$eval('.advisor-widget-sticky', (els) => els.length);
  assert.equal(count, 1);
  await page.close();
});

test('desktop sticky shows Talk to us label and accessible name', async () => {
  const page = await newPage({ width: 1024 });
  const sticky = await page.$('.advisor-widget-sticky');
  assert.ok(sticky);
  const label = await page.$eval('.advisor-widget-sticky__label', (el) => el.textContent.trim());
  assert.equal(label, 'Talk to us');
  const accessibleName = await page.$eval('.advisor-widget-sticky', (el) =>
    el.getAttribute('aria-label') || el.textContent.trim(),
  );
  assert.equal(accessibleName, 'Talk to us');
  await page.close();
});

test('open creates one dialog, locks body, and focuses first field', async () => {
  const page = await newPage();
  await page.click('#trigger');
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  const dialogCount = await page.$$eval('[role="dialog"]', (els) => els.length);
  assert.equal(dialogCount, 1);
  const modalOpen = await page.evaluate(() => document.body.classList.contains('modal-open'));
  assert.equal(modalOpen, true);
  const focusedId = await page.evaluate(() => document.activeElement?.id || document.activeElement?.name);
  const firstFieldFocused = await page.evaluate(() => {
    const first = document.querySelector('.advisor-widget-dialog input, .advisor-widget-dialog select, .advisor-widget-dialog textarea');
    return document.activeElement === first;
  });
  assert.equal(firstFieldFocused, true);
  await page.close();
});

test('close removes dialog state and restores trigger focus', async () => {
  const page = await newPage();
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  await page.evaluate(() => window.AdvisorWidget.close());
  const dialogCount = await page.$$eval('[role="dialog"]', (els) => els.length);
  assert.equal(dialogCount, 0);
  const modalOpen = await page.evaluate(() => document.body.classList.contains('modal-open'));
  assert.equal(modalOpen, false);
  const triggerFocused = await page.evaluate(() => document.activeElement?.id === 'trigger');
  assert.equal(triggerFocused, true);
  await page.close();
});

test('escape closes the dialog', async () => {
  const page = await newPage();
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  await page.keyboard.press('Escape');
  const dialogCount = await page.$$eval('[role="dialog"]', (els) => els.length);
  assert.equal(dialogCount, 0);
  await page.close();
});

test('backdrop click closes the dialog', async () => {
  const page = await newPage();
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  const box = await page.$eval('.advisor-widget-modal', (el) => {
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y };
  });
  await page.mouse.click(box.x + 8, box.y + 8);
  const dialogCount = await page.$$eval('[role="dialog"]', (els) => els.length);
  assert.equal(dialogCount, 0);
  await page.close();
});

test('mobile dialog stays centered throughout its entry animation', async () => {
  const page = await newPage({ width: 390 });
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  await new Promise((resolve) => setTimeout(resolve, 50));
  const bounds = await page.$eval('.advisor-widget-dialog', (el) => {
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
    };
  });
  assert.ok(bounds.left >= 12, `dialog left edge ${bounds.left}px is clipped`);
  assert.ok(
    bounds.right <= bounds.viewportWidth - 12,
    `dialog right edge ${bounds.right}px exceeds ${bounds.viewportWidth}px viewport`,
  );
  await page.close();
});

test('setEnabled(false) hides sticky and closes an open dialog', async () => {
  const page = await newPage();
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  await page.evaluate(() => window.AdvisorWidget.setEnabled(false));
  const stickyVisible = await page.$eval('.advisor-widget-sticky', (el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
  assert.equal(stickyVisible, false);
  const dialogCount = await page.$$eval('[role="dialog"]', (els) => els.length);
  assert.equal(dialogCount, 0);
  await page.close();
});

test('modal includes WhatsApp link with configured URL', async () => {
  const page = await newPage();
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  const href = await page.$eval('.advisor-widget-whatsapp', (el) => el.href);
  const text = await page.$eval('.advisor-widget-whatsapp', (el) => el.textContent.trim());
  assert.equal(href, 'https://example.com/whatsapp');
  assert.match(text, /Talk to us on WhatsApp/);
  await page.close();
});

test('modal restores the previous icon-led course guidance design', async () => {
  const page = await newPage();
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  const ui = await page.evaluate(() => ({
    eyebrow: document.querySelector('.cv3-eyebrow')?.textContent.trim(),
    title: document.querySelector('.cv3-enquiry-title')?.textContent.trim(),
    hasCard: !!document.querySelector('.cv3-enquiry-card'),
    fieldCount: document.querySelectorAll('.cv3-field').length,
    leadingIconCount: document.querySelectorAll('.cv3-field > svg:first-child').length,
    placeholders: [...document.querySelectorAll('.cv3-field input, .cv3-field textarea')]
      .map((el) => el.placeholder),
    secureNote: document.querySelector('.cv3-enquiry-note')?.textContent.trim(),
    closeHasSvg: !!document.querySelector('.cv3-advisor-close svg'),
    whatsappUsesPreviousStyle: !!document.querySelector('.cv3-whatsapp-btn'),
  }));
  assert.equal(ui.eyebrow, 'Course guidance');
  assert.equal(ui.title, 'Talk to a Course Advisor');
  assert.equal(ui.hasCard, true);
  assert.equal(ui.fieldCount, 5);
  assert.equal(ui.leadingIconCount, 5);
  assert.deepEqual(ui.placeholders, [
    'Your Name',
    'Email Address',
    'Phone Number *',
    'Anything you’d like us to know? (optional)',
  ]);
  assert.equal(ui.secureNote, 'Your information is secure with us');
  assert.equal(ui.closeHasSvg, true);
  assert.equal(ui.whatsappUsesPreviousStyle, true);
  await page.close();
});

test('phone selector detects the browser country and exposes the full country list', async () => {
  const page = await browser.newPage();
  await loadWidgetPage(page, { languages: ['en-GB'] });
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  const phoneUi = await page.evaluate(() => {
    const select = document.querySelector('[name="phoneCountry"]');
    return {
      selectedIso: select?.value,
      optionCount: select?.options.length,
      selectedDisplay: document.querySelector('.advisor-widget-phone-country-display')?.textContent.trim(),
      countryAutocomplete: select?.autocomplete,
      nationalAutocomplete: document.querySelector('[name="phone"]')?.autocomplete,
    };
  });
  assert.equal(phoneUi.selectedIso, 'GB');
  assert.ok(phoneUi.optionCount >= 200);
  assert.equal(phoneUi.selectedDisplay, '🇬🇧 +44');
  assert.equal(phoneUi.countryAutocomplete, 'tel-country-code');
  assert.equal(phoneUi.nationalAutocomplete, 'tel-national');
  await page.close();
});

test('phone selector falls back to India and updates its compact display', async () => {
  const page = await browser.newPage();
  await loadWidgetPage(page, { languages: ['fr'] });
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  assert.equal(await page.$eval('[name="phoneCountry"]', (el) => el.value), 'IN');
  assert.equal(
    await page.$eval('.advisor-widget-phone-country-display', (el) => el.textContent.trim()),
    '🇮🇳 +91',
  );
  await page.select('[name="phoneCountry"]', 'US');
  assert.equal(
    await page.$eval('.advisor-widget-phone-country-display', (el) => el.textContent.trim()),
    '🇺🇸 +1',
  );
  await page.close();
});

test('empty submission shows name email phone errors without fetch', async () => {
  const page = await newPage();
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  await page.click('.advisor-widget-dialog button[type="submit"]');
  const errors = await page.$$eval('.advisor-widget-error[data-field]', (els) => els.map((el) => el.textContent.trim()));
  assert.ok(errors.some((e) => /name/i.test(e)), 'name error shown');
  assert.ok(errors.some((e) => /email/i.test(e)), 'email error shown');
  assert.ok(errors.some((e) => /phone/i.test(e)), 'phone error shown');
  const describedBy = await page.$eval('[name="name"]', (el) => el.getAttribute('aria-describedby'));
  assert.equal(describedBy, 'advisor-widget-error-name');
  const fetchCount = await page.evaluate(() => window.__fetchCalls.length);
  assert.equal(fetchCount, 0);
  await page.close();
});

test('repeated open does not register duplicate document keydown listeners', async () => {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    window.__docKeydownAdds = 0;
    const orig = Document.prototype.addEventListener;
    Document.prototype.addEventListener = function (type, listener, options) {
      if (type === 'keydown' && this === window.document) window.__docKeydownAdds += 1;
      return orig.call(this, type, listener, options);
    };
  });
  await page.goto('about:blank');
  await loadWidgetPage(page);
  await page.evaluate(() => {
    const trigger = document.getElementById('trigger');
    window.AdvisorWidget.open(trigger);
    window.AdvisorWidget.open(trigger);
    window.AdvisorWidget.open(trigger);
  });
  const adds = await page.evaluate(() => window.__docKeydownAdds);
  assert.equal(adds, 1);
  await page.keyboard.press('Escape');
  const dialogCount = await page.$$eval('[role="dialog"]', (els) => els.length);
  assert.equal(dialogCount, 0);
  await page.close();
});

test('setEnabled(true) remains disabled on private /courses path', async () => {
  const page = await browser.newPage();
  await loadWidgetPage(page, { pathname: '/courses' });
  await page.evaluate(() => window.AdvisorWidget.setEnabled(true));
  const sticky = await page.$eval('.advisor-widget-sticky', (el) => ({
    hidden: el.hidden,
    display: window.getComputedStyle(el).display,
  }));
  assert.equal(sticky.hidden, true);
  assert.equal(sticky.display, 'none');
  await page.close();
});

test('setEnabled(false) closes before hiding and does not focus hidden sticky', async () => {
  const page = await newPage();
  await page.evaluate(() => window.AdvisorWidget.open(document.querySelector('.advisor-widget-sticky')));
  await page.evaluate(() => window.AdvisorWidget.setEnabled(false));
  const result = await page.evaluate(() => ({
    stickyHidden: document.querySelector('.advisor-widget-sticky')?.hidden === true,
    activeIsSticky: document.activeElement?.classList?.contains('advisor-widget-sticky') === true,
    dialogCount: document.querySelectorAll('[role="dialog"]').length,
  }));
  assert.equal(result.stickyHidden, true);
  assert.equal(result.activeIsSticky, false);
  assert.equal(result.dialogCount, 0);
  await page.close();
});

test('repeated open close cycles do not grow modal listener bookkeeping', async () => {
  const page = await newPage();
  for (let i = 0; i < 3; i += 1) {
    await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
    await page.evaluate(() => window.AdvisorWidget.close());
  }
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  const box = await page.$eval('.advisor-widget-modal', (el) => {
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y };
  });
  await page.mouse.click(box.x + 8, box.y + 8);
  const dialogCount = await page.$$eval('[role="dialog"]', (els) => els.length);
  assert.equal(dialogCount, 0);
  await page.close();
});

test('valid submission executes recaptcha and posts normalized payload', async () => {
  const page = await newPage({ languages: ['en-US'] });
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  await page.type('[name="name"]', 'Asha Rao');
  await page.type('[name="email"]', 'asha@example.com');
  await page.type('[name="phone"]', '415 555-0132');
  assert.equal(await page.$eval('[name="phone"]', (el) => el.value), '4155550132');
  await page.type('[name="message"]', '  Please call after 6 PM.  ');
  await page.select('[name="occupation"]', 'Student');
  await page.click('.advisor-widget-dialog button[type="submit"]');
  await page.waitForFunction(() => window.__fetchCalls.length === 1);

  const grecaptchaCalls = await page.evaluate(() => window.__grecaptchaCalls);
  assert.deepEqual(grecaptchaCalls[0], ['test-site-key', { action: 'course_enquiry' }]);

  const fetchCall = await page.evaluate(() => window.__fetchCalls[0]);
  assert.equal(fetchCall.url, '/api/course-enquiry');
  assert.equal(fetchCall.init.method, 'POST');
  assert.match(fetchCall.init.headers['Content-Type'], /application\/json/i);
  const body = JSON.parse(fetchCall.init.body);
  assert.deepEqual(body, {
    name: 'Asha Rao',
    email: 'asha@example.com',
    phone: '+14155550132',
    occupation: 'Student',
    message: 'Please call after 6 PM.',
    recaptchaToken: 'test-token',
  });
  await page.close();
});

test('success shows approved callback confirmation copy', async () => {
  const page = await newPage();
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  await page.type('[name="name"]', 'Asha Rao');
  await page.type('[name="email"]', 'asha@example.com');
  await page.type('[name="phone"]', '9876543210');
  await page.click('.advisor-widget-dialog button[type="submit"]');
  await page.waitForSelector('.advisor-widget-success');
  const successText = await page.$eval('.advisor-widget-success', (el) => el.textContent.trim());
  assert.equal(
    successText,
    'Thanks—your request is in. A course advisor will call you within 24 hours.',
  );
  assert.ok(await page.$('.cv3-advisor-success'));
  assert.equal(
    await page.$eval('.cv3-advisor-success-icon', (el) => el.textContent.trim()),
    '✓',
  );
  assert.equal(
    await page.$eval('.cv3-advisor-success button', (el) => el.textContent.trim()),
    'Close',
  );
  await page.close();
});

test('failed request retains values and keeps WhatsApp available', async () => {
  const page = await newPage();
  await page.evaluate(() => {
    window.__fetchImpl = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, message: 'We couldn\u2019t submit your request. Please try again.' }),
    });
  });
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  await page.type('[name="name"]', 'Asha Rao');
  await page.type('[name="email"]', 'asha@example.com');
  await page.type('[name="phone"]', '9876543210');
  await page.click('.advisor-widget-dialog button[type="submit"]');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.advisor-widget-dialog .advisor-widget-error')]
      .some((el) => el.textContent.trim().length > 0),
  );
  const nameVal = await page.$eval('[name="name"]', (el) => el.value);
  const emailVal = await page.$eval('[name="email"]', (el) => el.value);
  const phoneVal = await page.$eval('[name="phone"]', (el) => el.value);
  assert.equal(nameVal, 'Asha Rao');
  assert.equal(emailVal, 'asha@example.com');
  assert.equal(phoneVal, '9876543210');
  const whatsapp = await page.$('.advisor-widget-whatsapp');
  assert.ok(whatsapp);
  await page.close();
});

test('repeated submit clicks while pending make one request', async () => {
  const page = await newPage();
  let resolveFetch;
  const fetchStarted = new Promise((resolve) => { resolveFetch = resolve; });
  await page.evaluate(() => {
    window.__fetchImpl = () => new Promise((resolve) => {
      window.__resolveFetch = () => resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
    });
  });
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  await page.type('[name="name"]', 'Asha Rao');
  await page.type('[name="email"]', 'asha@example.com');
  await page.type('[name="phone"]', '9876543210');
  const submitBtn = '.advisor-widget-dialog button[type="submit"]';
  await page.click(submitBtn);
  await page.click(submitBtn);
  await page.click(submitBtn);
  await page.waitForFunction(() => window.__fetchCalls.length >= 1);
  const fetchCount = await page.evaluate(() => window.__fetchCalls.length);
  assert.equal(fetchCount, 1);
  await page.evaluate(() => window.__resolveFetch());
  await page.close();
});

test('a closed pending submission cannot mutate a newly reopened dialog', async () => {
  const page = await newPage();
  await page.evaluate(() => {
    window.__fetchImpl = () => new Promise((resolve) => {
      window.__resolveFetch = () => resolve({
        ok: false,
        status: 500,
        json: async () => ({ ok: false }),
      });
    });
    window.AdvisorWidget.open(document.getElementById('trigger'));
  });
  await page.type('[name="name"]', 'Asha Rao');
  await page.type('[name="email"]', 'asha@example.com');
  await page.type('[name="phone"]', '9876543210');
  await page.click('.advisor-widget-dialog button[type="submit"]');
  await page.waitForFunction(() => window.__fetchCalls.length === 1);

  await page.evaluate(() => {
    window.AdvisorWidget.close();
    window.AdvisorWidget.open(document.getElementById('trigger'));
    window.__resolveFetch();
  });
  await new Promise((resolve) => setTimeout(resolve, 25));

  const state = await page.evaluate(() => ({
    hasForm: !!document.querySelector('.advisor-widget-dialog form'),
    hasSuccess: !!document.querySelector('.advisor-widget-success'),
    visibleErrors: [...document.querySelectorAll('.advisor-widget-dialog .advisor-widget-error')]
      .some((el) => !el.hidden && el.textContent.trim()),
  }));
  assert.equal(state.hasForm, true);
  assert.equal(state.hasSuccess, false);
  assert.equal(state.visibleErrors, false);
  await page.close();
});

test('missing recaptcha key fails closed before fetch', async () => {
  const page = await newPage({ recaptchaSiteKey: '' });
  await page.evaluate(() => window.AdvisorWidget.open(document.getElementById('trigger')));
  await page.type('[name="name"]', 'Asha Rao');
  await page.type('[name="email"]', 'asha@example.com');
  await page.type('[name="phone"]', '9876543210');
  await page.click('.advisor-widget-dialog button[type="submit"]');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.advisor-widget-dialog .advisor-widget-error')]
      .some((el) => el.textContent.trim().length > 0),
  );
  const fetchCount = await page.evaluate(() => window.__fetchCalls.length);
  assert.equal(fetchCount, 0);
  const errorText = await page.evaluate(() =>
    [...document.querySelectorAll('.advisor-widget-dialog .advisor-widget-error')]
      .map((el) => el.textContent.trim())
      .find(Boolean) || '',
  );
  assert.match(errorText, /try again|WhatsApp/i);
  await page.close();
});
