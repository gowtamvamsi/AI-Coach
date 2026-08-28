// Shared sticky advisor widget — loaded on React and static public pages.
// Exposes window.AdvisorWidget; no module system (plain script tag).
(function () {
  'use strict';

  var RECAPTCHA_ACTION = 'course_enquiry';
  var SUCCESS_MESSAGE = 'Thanks—your request is in. A course advisor will call you within 24 hours.';
  var GENERIC_ERROR = 'Something went wrong — please try again or reach us on WhatsApp.';
  var RECAPTCHA_ERROR = 'We couldn\u2019t verify your request. Please try again or reach us on WhatsApp.';
  var PRIVATE_PATHS = ['/account', '/dashboard', '/email-tasks', '/courses'];

  var EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  var state = {
    initialized: false,
    enabled: true,
    isOpen: false,
    keydownBound: false,
    stickyEl: null,
    modalEl: null,
    dialogEl: null,
    formEl: null,
    triggerEl: null,
    submitting: false,
    submitGeneration: 0,
    recaptchaLoadPromise: null,
    persistentListeners: [],
    modalListeners: [],
  };

  function getConfig() {
    return (typeof window !== 'undefined' && window.SITE_CONFIG) || {};
  }

  function getWhatsappUrl() {
    // ponytail: direct chat to the same number as the contact bar (app.jsx).
    // Hardcoded like the contact bar — the number isn't centralized in config.
    return 'https://wa.me/917981709999';
  }

  function getRecaptchaSiteKey() {
    var contact = getConfig().contact || {};
    return String(contact.recaptchaSiteKey || '').trim();
  }

  function getPhoneCountries() {
    if (Array.isArray(window.PHONE_COUNTRIES) && window.PHONE_COUNTRIES.length) {
      return window.PHONE_COUNTRIES;
    }
    return [{ iso: 'IN', dial: '+91', name: 'India' }];
  }

  function getPhoneCountry(iso) {
    var countries = getPhoneCountries();
    return countries.find(function (country) { return country.iso === iso; }) || countries[0];
  }

  function phoneFlag(iso) {
    if (window.PHONE_COUNTRY_UTILS && window.PHONE_COUNTRY_UTILS.flag) {
      return window.PHONE_COUNTRY_UTILS.flag(iso);
    }
    return iso === 'IN' ? '\uD83C\uDDEE\uD83C\uDDF3' : '';
  }

  function inferPhoneCountry() {
    var languages = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
    if (window.PHONE_COUNTRY_UTILS && window.PHONE_COUNTRY_UTILS.inferIso) {
      return window.PHONE_COUNTRY_UTILS.inferIso(languages);
    }
    return 'IN';
  }

  function normalizePathname(pathname) {
    return String(pathname || '/').replace(/\/+$/, '') || '/';
  }

  function isPrivatePath(pathname) {
    return PRIVATE_PATHS.indexOf(normalizePathname(pathname)) >= 0;
  }

  function shouldStartDisabled() {
    return isPrivatePath(window.location.pathname);
  }

  function countDigits(value) {
    return String(value).replace(/\D/g, '').length;
  }

  function validateFields(values) {
    var errors = {};
    var name = String(values.name || '').trim();
    var email = String(values.email || '').trim().toLowerCase();
    var phone = String(values.phone || '').trim();
    var occupation = String(values.occupation || '').trim();
    var message = String(values.message || '').trim();

    if (name.length < 2 || name.length > 80) {
      errors.name = name.length === 0 ? 'Please enter your name.' : 'Please enter your full name (2–80 characters).';
    }
    if (email.length < 3 || email.length > 254 || !EMAIL_RE.test(email)) {
      errors.email = email.length === 0 ? 'Please enter your email address.' : 'Please enter a valid email address.';
    }
    if (phone.length === 0 || phone.length > 32) {
      errors.phone = 'Please enter your phone number.';
    } else {
      var digits = countDigits(phone);
      if (digits < 7 || digits > 15) errors.phone = 'Please enter a valid phone number.';
    }
    if (occupation.length > 80) errors.occupation = 'Occupation is too long.';
    if (message.length > 1000) errors.message = 'Message is too long.';

    return errors;
  }

  function normalizePayload(values) {
    return {
      name: String(values.name || '').trim(),
      email: String(values.email || '').trim().toLowerCase(),
      phone: String(values.phone || '').trim(),
      occupation: String(values.occupation || '').trim(),
      message: String(values.message || '').trim(),
    };
  }

  function trackListener(bucket, target, type, handler, options) {
    target.addEventListener(type, handler, options);
    bucket.push({ target: target, type: type, handler: handler, options: options });
  }

  function addPersistentListener(target, type, handler, options) {
    trackListener(state.persistentListeners, target, type, handler, options);
  }

  function addModalListener(target, type, handler, options) {
    trackListener(state.modalListeners, target, type, handler, options);
  }

  function clearListenerBucket(bucket) {
    bucket.forEach(function (entry) {
      entry.target.removeEventListener(entry.type, entry.handler, entry.options);
    });
    bucket.length = 0;
  }

  function clearModalListeners() {
    clearListenerBucket(state.modalListeners);
  }

  function clearPersistentListeners() {
    clearListenerBucket(state.persistentListeners);
  }

  function ensureRecaptchaScript(siteKey) {
    if (!siteKey) return Promise.reject(new Error('missing-recaptcha-key'));
    if (window.grecaptcha && typeof window.grecaptcha.execute === 'function') {
      return new Promise(function (resolve) {
        window.grecaptcha.ready(resolve);
      });
    }
    if (state.recaptchaLoadPromise) return state.recaptchaLoadPromise;

    state.recaptchaLoadPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-advisor-recaptcha="1"]');
      var script = existing;

      function onReady() {
        if (window.grecaptcha && typeof window.grecaptcha.execute === 'function') {
          window.grecaptcha.ready(resolve);
        } else {
          reject(new Error('recaptcha-unavailable'));
        }
      }

      function onError() {
        state.recaptchaLoadPromise = null;
        reject(new Error('recaptcha-load-failed'));
      }

      if (script) {
        script.addEventListener('load', onReady, { once: true });
        script.addEventListener('error', onError, { once: true });
        return;
      }

      script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(siteKey);
      script.async = true;
      script.defer = true;
      script.setAttribute('data-advisor-recaptcha', '1');
      script.addEventListener('load', onReady, { once: true });
      script.addEventListener('error', onError, { once: true });
      document.head.appendChild(script);
    });

    return state.recaptchaLoadPromise;
  }

  function executeRecaptcha(siteKey) {
    return ensureRecaptchaScript(siteKey).then(function () {
      return window.grecaptcha.execute(siteKey, { action: RECAPTCHA_ACTION });
    });
  }

  function canRestoreFocus(el) {
    if (!el || typeof el.focus !== 'function') return false;
    if (el.hidden) return false;
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  }

  function createPhoneIcon() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'advisor-widget-sticky__icon');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z');
    svg.appendChild(path);
    return svg;
  }

  function createSvgIcon(nodes, options) {
    options = options || {};
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var size = String(options.size || 18);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', options.viewBox || '0 0 24 24');
    svg.setAttribute('fill', options.fill || 'none');
    if (options.stroke !== false) {
      svg.setAttribute('stroke', options.stroke || 'currentColor');
      svg.setAttribute('stroke-width', String(options.strokeWidth || 1.8));
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
    }
    if (options.className) svg.setAttribute('class', options.className);
    svg.setAttribute('aria-hidden', 'true');
    nodes.forEach(function (node) {
      var child = document.createElementNS('http://www.w3.org/2000/svg', node.tag);
      Object.keys(node.attrs).forEach(function (key) {
        child.setAttribute(key, node.attrs[key]);
      });
      svg.appendChild(child);
    });
    return svg;
  }

  function clearFieldErrors(form) {
    form.querySelectorAll('.advisor-widget-error[data-field]').forEach(function (el) {
      el.textContent = '';
      el.hidden = true;
    });
    form.querySelectorAll('.advisor-widget-field').forEach(function (el) {
      el.removeAttribute('aria-invalid');
      el.classList.remove('cv3-field--invalid');
    });
    form.querySelectorAll('.advisor-widget-field input, .advisor-widget-field select, .advisor-widget-field textarea').forEach(function (el) {
      el.removeAttribute('aria-invalid');
    });
    var formError = form.querySelector('.advisor-widget-error:not([data-field])');
    if (formError) formError.remove();
  }

  function showFieldErrors(form, errors) {
    Object.keys(errors).forEach(function (field) {
      var input = form.querySelector('[name="' + field + '"]');
      if (!input) return;
      var wrap = input.closest('.advisor-widget-field') || input.parentElement;
      var err = form.querySelector('#advisor-widget-error-' + field);
      if (!err) return;
      if (wrap) wrap.setAttribute('aria-invalid', 'true');
      if (wrap) wrap.classList.add('cv3-field--invalid');
      input.setAttribute('aria-invalid', 'true');
      err.textContent = errors[field];
      err.hidden = false;
    });
  }

  function showFormError(form, message) {
    if (!form) return;
    var existing = form.querySelector('.advisor-widget-error:not([data-field])');
    if (existing) existing.remove();
    var err = document.createElement('p');
    err.className = 'advisor-widget-error cv3-enquiry-error';
    err.textContent = message;
    var submitBtn = form.querySelector('button[type="submit"]');
    form.insertBefore(err, submitBtn);
  }

  function getFocusableElements(container) {
    return Array.prototype.slice.call(
      container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  function trapFocus(event) {
    if (!state.dialogEl || event.key !== 'Tab') return;
    var focusable = getFocusableElements(state.dialogEl);
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') close();
    trapFocus(event);
  }

  function bindDocumentKeydown() {
    if (state.keydownBound) return;
    document.addEventListener('keydown', onKeyDown);
    state.keydownBound = true;
  }

  function unbindDocumentKeydown() {
    if (!state.keydownBound) return;
    document.removeEventListener('keydown', onKeyDown);
    state.keydownBound = false;
  }

  function buildModal() {
    if (state.modalEl) return;

    var backdrop = document.createElement('div');
    backdrop.className = 'advisor-widget-modal cv3-advisor-modal';
    backdrop.hidden = true;

    var dialog = document.createElement('div');
    dialog.className = 'advisor-widget-dialog cv3-advisor-dialog';
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'advisor-widget-title');
    dialog.setAttribute('aria-describedby', 'advisor-widget-intro');

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'advisor-widget-close cv3-advisor-close';
    closeBtn.setAttribute('aria-label', 'Close advisor form');
    closeBtn.appendChild(createSvgIcon([
      { tag: 'path', attrs: { d: 'm6 6 12 12M18 6 6 18' } },
    ], { size: 20, strokeWidth: 2 }));

    var card = document.createElement('div');
    card.className = 'cv3-enquiry-card';

    var eyebrow = document.createElement('div');
    eyebrow.className = 'cv3-eyebrow';
    eyebrow.textContent = 'Course guidance';

    var title = document.createElement('h2');
    title.id = 'advisor-widget-title';
    title.className = 'advisor-widget-title cv3-enquiry-title';
    title.textContent = 'Talk to a Course Advisor';

    var intro = document.createElement('p');
    intro.id = 'advisor-widget-intro';
    intro.className = 'advisor-widget-intro cv3-advisor-intro';
    intro.textContent = 'Share your details and we\u2019ll help you decide whether this course is the right fit.';

    var form = document.createElement('form');
    form.className = 'advisor-widget-form cv3-enquiry-fields';
    form.noValidate = true;

    function addField(name, label, type, options) {
      options = options || {};
      var wrap = document.createElement('label');
      wrap.className = 'advisor-widget-field cv3-field';
      if (options.tag === 'select') wrap.classList.add('cv3-field--select');
      if (options.tag === 'textarea') wrap.classList.add('cv3-field--textarea');
      wrap.appendChild(createSvgIcon(options.icon || [], { size: 18, strokeWidth: 1.8 }));
      var input;
      if (options.tag === 'select') {
        input = document.createElement('select');
        (options.options || []).forEach(function (opt) {
          var option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.text;
          input.appendChild(option);
        });
      } else if (options.tag === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
      } else {
        input = document.createElement('input');
        input.type = type || 'text';
      }
      input.name = name;
      input.setAttribute('aria-label', label);
      if (options.required) input.required = true;
      if (options.placeholder) input.placeholder = options.placeholder;
      var errorId = 'advisor-widget-error-' + name;
      input.setAttribute('aria-describedby', errorId);
      wrap.appendChild(input);
      if (options.tag === 'select') {
        wrap.appendChild(createSvgIcon([
          { tag: 'path', attrs: { d: 'm6 9 6 6 6-6' } },
        ], { size: 16, strokeWidth: 2, className: 'cv3-field-chevron' }));
      }
      form.appendChild(wrap);
      var err = document.createElement('p');
      err.id = errorId;
      err.className = 'advisor-widget-error cv3-field-err';
      err.setAttribute('data-field', name);
      err.hidden = true;
      form.appendChild(err);
      return input;
    }

    function addPhoneField() {
      var countries = getPhoneCountries();
      var initialIso = inferPhoneCountry();
      var wrap = document.createElement('div');
      wrap.className = 'advisor-widget-field advisor-widget-phone-field cv3-field';
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', 'Phone number');
      wrap.appendChild(createSvgIcon([
        { tag: 'path', attrs: { d: 'M4 5c0 9 6 15 15 15l2-3-4-2-2 2c-3-1.5-5.5-4-7-7l2-2-2-4z' } },
      ], { size: 18, strokeWidth: 1.8 }));

      var countryWrap = document.createElement('span');
      countryWrap.className = 'advisor-widget-phone-country';
      var countryDisplay = document.createElement('span');
      countryDisplay.className = 'advisor-widget-phone-country-display';
      countryDisplay.setAttribute('aria-hidden', 'true');
      var countrySelect = document.createElement('select');
      countrySelect.name = 'phoneCountry';
      countrySelect.className = 'advisor-widget-phone-country-select';
      countrySelect.setAttribute('aria-label', 'Country code');
      countrySelect.setAttribute('autocomplete', 'tel-country-code');
      countries.forEach(function (country) {
        var option = document.createElement('option');
        option.value = country.iso;
        option.textContent = country.name + ' (' + country.dial + ')';
        countrySelect.appendChild(option);
      });
      countrySelect.value = getPhoneCountry(initialIso).iso;
      var caret = document.createElement('span');
      caret.className = 'advisor-widget-phone-country-caret';
      caret.setAttribute('aria-hidden', 'true');
      caret.textContent = '\u25BE';
      countryWrap.appendChild(countryDisplay);
      countryWrap.appendChild(countrySelect);
      countryWrap.appendChild(caret);

      var divider = document.createElement('span');
      divider.className = 'advisor-widget-phone-divider';
      divider.setAttribute('aria-hidden', 'true');

      var input = document.createElement('input');
      input.type = 'tel';
      input.inputMode = 'numeric';
      input.name = 'phone';
      input.required = true;
      input.placeholder = 'Phone Number *';
      input.setAttribute('aria-label', 'Phone number');
      input.setAttribute('autocomplete', 'tel-national');
      input.setAttribute('aria-describedby', 'advisor-widget-error-phone');

      function updateCountry() {
        var country = getPhoneCountry(countrySelect.value);
        countrySelect.value = country.iso;
        countryDisplay.textContent = phoneFlag(country.iso) + ' ' + country.dial;
        input.maxLength = Math.max(4, 15 - countDigits(country.dial));
        input.value = input.value.replace(/\D/g, '').slice(0, input.maxLength);
      }

      addModalListener(countrySelect, 'change', updateCountry);
      addModalListener(input, 'input', function () {
        input.value = input.value.replace(/\D/g, '').slice(0, input.maxLength);
      });
      updateCountry();

      wrap.appendChild(countryWrap);
      wrap.appendChild(divider);
      wrap.appendChild(input);
      form.appendChild(wrap);

      var err = document.createElement('p');
      err.id = 'advisor-widget-error-phone';
      err.className = 'advisor-widget-error cv3-field-err';
      err.setAttribute('data-field', 'phone');
      err.hidden = true;
      form.appendChild(err);
    }

    addField('name', 'Your name', 'text', {
      required: true,
      placeholder: 'Your Name',
      icon: [
        { tag: 'circle', attrs: { cx: '12', cy: '8', r: '4' } },
        { tag: 'path', attrs: { d: 'M4 21c0-4 4-6 8-6s8 2 8 6' } },
      ],
    });
    addField('email', 'Email address', 'email', {
      required: true,
      placeholder: 'Email Address',
      icon: [
        { tag: 'rect', attrs: { x: '3', y: '5', width: '18', height: '14', rx: '2' } },
        { tag: 'path', attrs: { d: 'm3 7 9 6 9-6' } },
      ],
    });
    addPhoneField();
    addField('occupation', 'Occupation', null, {
      tag: 'select',
      icon: [
        { tag: 'path', attrs: { d: 'M4 6h16M4 6v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6M9 3h6' } },
      ],
      options: [
        { value: '', text: 'I am a\u2026' },
        { value: 'Working professional', text: 'Working professional' },
        { value: 'Student', text: 'Student' },
        { value: 'Homemaker', text: 'Homemaker' },
        { value: 'Founder / entrepreneur', text: 'Founder / entrepreneur' },
        { value: 'Other', text: 'Other' },
      ],
    });
    addField('message', 'Message (optional)', null, {
      tag: 'textarea',
      placeholder: 'Anything you\u2019d like us to know? (optional)',
      icon: [
        { tag: 'path', attrs: { d: 'M4 5h16v11H9l-4 3v-3H4z' } },
      ],
    });

    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'advisor-widget-submit cv3-enquiry-send';
    var submitLabel = document.createElement('span');
    submitLabel.className = 'advisor-widget-submit__label';
    submitLabel.textContent = 'REQUEST A CALLBACK';
    submitBtn.appendChild(submitLabel);
    submitBtn.appendChild(createSvgIcon([
      { tag: 'path', attrs: { d: 'm22 2-7 20-4-9-9-4z' } },
      { tag: 'path', attrs: { d: 'M22 2 11 13' } },
    ], { size: 18, strokeWidth: 1.8 }));
    form.appendChild(submitBtn);

    var note = document.createElement('div');
    note.className = 'advisor-widget-note cv3-enquiry-note';
    note.textContent = 'Your information is secure with us';
    form.appendChild(note);

    var whatsapp = document.createElement('a');
    whatsapp.className = 'advisor-widget-whatsapp cv3-whatsapp-btn';
    whatsapp.target = '_blank';
    whatsapp.rel = 'noopener noreferrer';
    whatsapp.appendChild(createSvgIcon([
      { tag: 'path', attrs: { d: 'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.004c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.02c-.24.68-1.4 1.3-1.94 1.35-.5.05-1.13.24-3.66-.77-3.08-1.24-5.06-4.4-5.22-4.6-.15-.2-1.25-1.66-1.25-3.17s.79-2.25 1.07-2.56c.28-.3.61-.38.82-.38.2 0 .41 0 .59.01.19.01.44-.07.69.53.24.6.83 2.06.9 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.36 1.46.3.15.47.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.68-.15.28.1 1.76.83 2.06.98.3.15.5.22.57.35.07.13.07.73-.17 1.4z' } },
    ], { size: 20, fill: '#25D366', stroke: false }));
    whatsapp.appendChild(document.createTextNode('Talk to us on WhatsApp'));

    card.appendChild(eyebrow);
    card.appendChild(title);
    card.appendChild(intro);
    card.appendChild(form);
    dialog.appendChild(closeBtn);
    dialog.appendChild(card);
    dialog.appendChild(whatsapp);
    backdrop.appendChild(dialog);

    addModalListener(backdrop, 'mousedown', function (event) {
      if (event.target === backdrop) close();
    });
    addModalListener(closeBtn, 'click', close);
    addModalListener(form, 'submit', handleSubmit);

    document.body.appendChild(backdrop);
    state.modalEl = backdrop;
    state.dialogEl = dialog;
    state.formEl = form;
  }

  function updateWhatsappLink() {
    if (!state.dialogEl) return;
    var link = state.dialogEl.querySelector('.advisor-widget-whatsapp');
    if (link) link.href = getWhatsappUrl();
  }

  function readFormValues() {
    if (!state.formEl) return {};
    var phoneInput = state.formEl.querySelector('[name="phone"]');
    var countrySelect = state.formEl.querySelector('[name="phoneCountry"]');
    var nationalNumber = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';
    var selectedCountry = getPhoneCountry(countrySelect ? countrySelect.value : 'IN');
    return {
      name: state.formEl.querySelector('[name="name"]').value,
      email: state.formEl.querySelector('[name="email"]').value,
      phone: nationalNumber ? selectedCountry.dial + nationalNumber : '',
      occupation: state.formEl.querySelector('[name="occupation"]').value,
      message: state.formEl.querySelector('[name="message"]').value,
    };
  }

  function setSubmitting(isSubmitting) {
    state.submitting = isSubmitting;
    if (!state.formEl) return;
    var btn = state.formEl.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = isSubmitting;
      var label = btn.querySelector('.advisor-widget-submit__label');
      if (label) label.textContent = isSubmitting ? 'SENDING\u2026' : 'REQUEST A CALLBACK';
    }
  }

  function showSuccess() {
    if (!state.dialogEl || !state.formEl) return;
    var intro = state.dialogEl.querySelector('.advisor-widget-intro');
    if (intro) intro.remove();
    state.formEl.remove();
    var whatsapp = state.dialogEl.querySelector('.advisor-widget-whatsapp');
    if (whatsapp) whatsapp.remove();
    var success = document.createElement('div');
    success.className = 'cv3-advisor-success';
    var icon = document.createElement('span');
    icon.className = 'cv3-advisor-success-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '\u2713';
    var message = document.createElement('p');
    message.className = 'advisor-widget-success cv3-enquiry-success';
    message.textContent = SUCCESS_MESSAGE;
    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'cv3-enquiry-send';
    closeButton.textContent = 'Close';
    addModalListener(closeButton, 'click', close);
    success.appendChild(icon);
    success.appendChild(message);
    success.appendChild(closeButton);
    var card = state.dialogEl.querySelector('.cv3-enquiry-card');
    if (card) card.appendChild(success);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (state.submitting) return;

    clearFieldErrors(state.formEl);
    var values = readFormValues();
    var errors = validateFields(values);
    if (Object.keys(errors).length > 0) {
      showFieldErrors(state.formEl, errors);
      return;
    }

    var siteKey = getRecaptchaSiteKey();
    if (!siteKey) {
      showFormError(state.formEl, RECAPTCHA_ERROR);
      return;
    }

    setSubmitting(true);
    var submissionId = ++state.submitGeneration;

    executeRecaptcha(siteKey)
      .then(function (token) {
        if (submissionId !== state.submitGeneration || !state.isOpen) {
          return { stale: true };
        }
        var payload = normalizePayload(values);
        payload.recaptchaToken = token;
        return fetch('/api/course-enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        });
      })
      .then(function (result) {
        if (!result || result.stale || submissionId !== state.submitGeneration || !state.isOpen) return;
        if (result.ok && result.data && result.data.ok) {
          showSuccess();
        } else {
          var msg = (result.data && result.data.message) || GENERIC_ERROR;
          showFormError(state.formEl, msg);
        }
      })
      .catch(function () {
        if (submissionId !== state.submitGeneration || !state.isOpen) return;
        showFormError(state.formEl, GENERIC_ERROR);
      })
      .finally(function () {
        if (submissionId === state.submitGeneration) setSubmitting(false);
      });
  }

  function open(trigger) {
    if (!state.enabled) return;
    if (state.isOpen) {
      if (trigger) state.triggerEl = trigger;
      return;
    }
    buildModal();
    updateWhatsappLink();
    state.triggerEl = trigger || state.triggerEl || null;
    state.modalEl.hidden = false;
    state.dialogEl.hidden = false;
    state.isOpen = true;
    document.body.classList.add('modal-open');
    bindDocumentKeydown();
    var firstInput = state.formEl.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
  }

  function close(options) {
    options = options || {};
    if (!state.isOpen) return;

    document.body.classList.remove('modal-open');
    state.submitGeneration += 1;
    unbindDocumentKeydown();
    clearModalListeners();

    if (state.modalEl && state.modalEl.parentNode) {
      state.modalEl.parentNode.removeChild(state.modalEl);
    }
    if (state.dialogEl && state.dialogEl.parentNode) {
      state.dialogEl.parentNode.removeChild(state.dialogEl);
    }

    state.modalEl = null;
    state.dialogEl = null;
    state.formEl = null;
    state.submitting = false;
    state.isOpen = false;

    if (options.restoreFocus !== false && canRestoreFocus(state.triggerEl)) {
      state.triggerEl.focus();
    }
  }

  function setEnabled(enabled) {
    var next = !!enabled;
    if (next && isPrivatePath(window.location.pathname)) {
      next = false;
    }
    if (!next) {
      close({ restoreFocus: false });
    }
    state.enabled = next;
    if (state.stickyEl) {
      state.stickyEl.hidden = !next;
    }
  }

  function renderSticky() {
    if (state.stickyEl) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'advisor-widget-sticky';
    btn.setAttribute('aria-label', 'Talk to us');
    btn.appendChild(createPhoneIcon());
    var label = document.createElement('span');
    label.className = 'advisor-widget-sticky__label';
    label.textContent = 'Talk to us';
    btn.appendChild(label);

    addPersistentListener(btn, 'click', function () {
      open(btn);
    });

    document.body.appendChild(btn);
    state.stickyEl = btn;
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    renderSticky();
    if (shouldStartDisabled()) {
      state.enabled = false;
      state.stickyEl.hidden = true;
    }
    var siteKey = getRecaptchaSiteKey();
    if (siteKey) ensureRecaptchaScript(siteKey).catch(function () {});
  }

  function destroy() {
    close({ restoreFocus: false });
    clearPersistentListeners();
    if (state.stickyEl && state.stickyEl.parentNode) {
      state.stickyEl.parentNode.removeChild(state.stickyEl);
    }
    state.stickyEl = null;
    state.initialized = false;
    state.recaptchaLoadPromise = null;
  }

  window.AdvisorWidget = Object.freeze({
    init: init,
    open: open,
    close: close,
    setEnabled: setEnabled,
    destroy: destroy,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
