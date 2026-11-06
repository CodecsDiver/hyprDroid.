/*
 * Shared pop-up windows for all three prototypes: the first-visit welcome
 * window, the consultation request (a REQUEST, never a booking) and the
 * privacy note. Each prototype styles them in its own way through CSS.
 *
 * Everything here is a demonstration. Nothing is sent, saved or reserved.
 */
(function () {
  'use strict';

  var content = window.ShawnContent;
  var esc = window.ShawnUtil.escapeHtml;

  var settings = null;       // set by mount()
  var welcomeHeld = false;   // the review studio can hold the welcome window back
  var welcomePending = false;

  function lines(list) {
    return (Array.isArray(list) ? list : [list]).map(esc).join('<br>');
  }

  function reviewId(suffix) {
    return settings.prototypeId + '.site.' + suffix;
  }

  /* ---------- storage (first-visit memory) ---------- */
  function welcomeKey() { return 'shawnPrototype.welcomeSeen.' + settings.prototypeId; }
  function hasSeenWelcome() {
    try { return window.localStorage.getItem(welcomeKey()) === '1'; } catch (e) { return false; }
  }
  function rememberWelcome() {
    try { window.localStorage.setItem(welcomeKey(), '1'); } catch (e) { /* storage unavailable: window may show again */ }
  }

  /* ---------- markup ---------- */
  function buildMarkup() {
    var copy = settings.copy;
    var id = reviewId;

    var timeOptions = content.sampleTimes.map(function (time) {
      return '<label class="radio"><input type="radio" name="time" value="' + esc(time.id) + '">' + esc(time.label) + '</label>';
    }).join('');

    return '' +
    '<dialog id="welcome" class="dlg" aria-labelledby="welcome-title" data-review-id="' + id('welcome') + '">' +
      '<div class="welcome-art" data-review-id="' + id('welcome.art') + '">' + lines(copy.welcomeArt) + '<span aria-hidden="true">✦</span></div>' +
      '<div class="dialog-content">' +
        '<p class="eyebrow">' + esc(copy.welcomeEyebrow) + '</p>' +
        '<h2 id="welcome-title">' + lines(copy.welcomeTitle) + '</h2>' +
        '<p>' + lines(copy.welcomeBody) + '</p>' +
        '<button class="button full" id="welcome-consult" data-review-id="' + id('welcome.consult') + '">Schedule an expert’s free consultation <span aria-hidden="true">↗</span></button>' +
        '<button class="button secondary full" id="welcome-explore" data-review-id="' + id('welcome.explore') + '">I’m still deciding what I need <span aria-hidden="true">→</span></button>' +
        '<small>No contact details needed to explore.</small>' +
      '</div>' +
    '</dialog>' +

    '<dialog id="consult" class="dlg" aria-labelledby="consult-title" data-review-id="' + id('consult') + '">' +
      '<button class="close" type="button" aria-label="Close consultation request" data-review-excluded="The × close button on pop-up windows is not selectable.">×</button>' +
      '<div class="dialog-content">' +
        '<p class="eyebrow">' + esc(copy.consultEyebrow) + '</p>' +
        '<h2 id="consult-title">' + lines(copy.consultTitle) + '</h2>' +
        '<p>Start with what’s on your mind. Choose how you’d prefer Shawn to get in touch.</p>' +
        '<form id="consult-form" novalidate>' +
          '<div class="form-group" data-review-id="' + id('consult.details') + '">' +
            '<label for="field-name">Your name <span>(required)</span></label>' +
            '<input id="field-name" name="name" autocomplete="name" maxlength="100" aria-required="true" aria-describedby="error-name">' +
            '<p class="field-error" id="error-name" hidden></p>' +
            '<label for="field-business">Business name <span>(optional)</span></label>' +
            '<input id="field-business" name="business" autocomplete="organization" maxlength="150">' +
          '</div>' +
          '<fieldset data-review-id="' + id('consult.contact-preference') + '">' +
            '<legend>How would you like to connect?</legend>' +
            '<label class="radio"><input type="radio" name="method" value="email" checked>Email</label>' +
            '<label class="radio"><input type="radio" name="method" value="phone">Phone call</label>' +
          '</fieldset>' +
          '<div class="fields" data-review-id="' + id('consult.contact-fields') + '">' +
            '<div><label for="field-email">Email <span id="email-status">(required)</span></label>' +
              '<input id="field-email" name="email" type="email" autocomplete="email" maxlength="254" aria-required="true" aria-describedby="error-email">' +
              '<p class="field-error" id="error-email" hidden></p></div>' +
            '<div><label for="field-phone">Phone <span id="phone-status">(optional)</span></label>' +
              '<input id="field-phone" name="phone" type="tel" autocomplete="tel" maxlength="30" aria-describedby="error-phone">' +
              '<p class="field-error" id="error-phone" hidden></p></div>' +
          '</div>' +
          '<fieldset class="times" data-review-id="' + id('consult.time-picker') + '">' +
            '<legend>Would a time help? <span>(optional)</span></legend>' +
            '<p class="sample-label">Sample times for illustration only. This is not real availability, and choosing one does not reserve it.</p>' +
            '<label class="radio"><input type="radio" name="time" value="none" checked>No preference</label>' + timeOptions +
          '</fieldset>' +
          '<div class="form-group" data-review-id="' + id('consult.message') + '">' +
            '<label for="field-message">What could use a little clarity? <span>(optional)</span></label>' +
            '<textarea id="field-message" name="message" rows="3" maxlength="1500" placeholder="A sentence or two is plenty. Please leave out financial account numbers and tax IDs."></textarea>' +
          '</div>' +
          '<div class="form-group" data-review-id="' + id('consult.consent') + '">' +
            '<label class="check" for="field-consent"><input id="field-consent" name="consent" type="checkbox" aria-describedby="error-consent"><span>I agree to be contacted about this inquiry using my preferred method.</span></label>' +
            '<p class="field-error" id="error-consent" hidden></p>' +
          '</div>' +
          '<button class="button full" type="submit" data-review-id="' + id('consult.submit') + '">Preview my consultation request <span aria-hidden="true">↗</span></button>' +
          '<p class="form-note" data-review-id="' + id('consult.notice') + '">' + esc(content.demoNotice) + '</p>' +
        '</form>' +
        '<div id="form-result" class="consult-result" role="status" tabindex="-1" hidden data-review-id="' + id('consult.result') + '"></div>' +
      '</div>' +
    '</dialog>' +

    '<dialog id="privacy" class="dlg" aria-labelledby="privacy-title" data-review-id="' + id('privacy') + '">' +
      '<button class="close" type="button" aria-label="Close privacy information" data-review-excluded="The × close button on pop-up windows is not selectable.">×</button>' +
      '<div class="dialog-content">' +
        '<p class="eyebrow">YOUR PRIVACY</p>' +
        '<h2 id="privacy-title">Only what’s needed.</h2>' +
        content.privacyParagraphs.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
      '</div>' +
    '</dialog>';
  }

  /* ---------- contact preference + validation ---------- */
  function elements() {
    var form = document.getElementById('consult-form');
    return {
      form: form,
      consult: document.getElementById('consult'),
      welcome: document.getElementById('welcome'),
      privacy: document.getElementById('privacy'),
      result: document.getElementById('form-result')
    };
  }

  function currentMethod(form) {
    return form.elements.method.value === 'phone' ? 'phone' : 'email';
  }

  function updateContactPreference() {
    var ui = elements();
    var isEmail = currentMethod(ui.form) === 'email';
    ui.form.elements.email.setAttribute('aria-required', isEmail ? 'true' : 'false');
    ui.form.elements.phone.setAttribute('aria-required', isEmail ? 'false' : 'true');
    document.getElementById('email-status').textContent = isEmail ? '(required)' : '(optional)';
    document.getElementById('phone-status').textContent = isEmail ? '(optional)' : '(required)';
  }

  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validate(form) {
    var errors = {};
    var method = currentMethod(form);
    var name = form.elements.name.value.trim();
    var email = form.elements.email.value.trim();
    var phone = form.elements.phone.value.trim();
    var phoneDigits = phone.replace(/\D/g, '');

    if (!name) errors.name = 'Please tell us your name.';
    if (method === 'email' && !email) errors.email = 'Email is required because you chose email.';
    else if (email && !emailPattern.test(email)) errors.email = 'That email doesn’t look complete. Try something like name@example.com.';
    if (method === 'phone' && !phone) errors.phone = 'Phone is required because you chose a phone call.';
    else if (phone && (phoneDigits.length < 10 || phoneDigits.length > 15 || /[^\d\s().+-]/.test(phone))) errors.phone = 'Please enter a phone number with area code.';
    if (!form.elements.consent.checked) errors.consent = 'Please check the box so we know you’re comfortable being contacted.';
    return errors;
  }

  function showErrors(form, errors) {
    ['name', 'email', 'phone', 'consent'].forEach(function (field) {
      var message = document.getElementById('error-' + field);
      var input = form.elements[field];
      if (errors[field]) {
        message.textContent = errors[field];
        message.hidden = false;
        input.setAttribute('aria-invalid', 'true');
      } else {
        message.textContent = '';
        message.hidden = true;
        input.removeAttribute('aria-invalid');
      }
    });
    var first = ['name', 'email', 'phone', 'consent'].filter(function (f) { return errors[f]; })[0];
    if (first) form.elements[first].focus();
  }

  function sampleTimeLabel(id) {
    var match = content.sampleTimes.filter(function (t) { return t.id === id; })[0];
    return match ? match.label : null;
  }

  function showResult(form) {
    var ui = elements();
    var method = currentMethod(form);
    var timeLabel = sampleTimeLabel(form.elements.time.value);
    var methodText = method === 'email' ? 'Email' : 'Phone call';
    var parts = [];
    parts.push('<h3>Request preview complete</h3>');
    parts.push('<p><strong>This is a request, not a booked appointment.</strong> Nothing was sent, saved or reserved.</p>');
    parts.push('<dl><dt>Preferred contact</dt><dd>' + esc(methodText) + '</dd>');
    parts.push('<dt>Sample time</dt><dd>' + (timeLabel ? esc(timeLabel) + ' (sample only — not reserved)' : 'No preference. Shawn would suggest times.') + '</dd></dl>');
    parts.push('<p>On the live website, Shawn would reply by ' + (method === 'email' ? 'email' : 'phone') + ' to agree on a time. Until he confirms, nothing is scheduled.</p>');
    parts.push('<div class="result-actions"><button type="button" class="button secondary" data-result-edit>Edit my request</button><button type="button" class="button" data-result-done>Back to the website</button></div>');
    ui.result.innerHTML = parts.join('');
    ui.result.hidden = false;
    ui.form.hidden = true;
    ui.result.focus();
  }

  function resetConsult() {
    var ui = elements();
    ui.form.reset();
    ui.form.hidden = false;
    ui.result.hidden = true;
    ui.result.innerHTML = '';
    showErrors(ui.form, {});
    ui.form.querySelectorAll('.field-error').forEach(function (n) { n.hidden = true; });
    updateContactPreference();
  }

  /* ---------- opening and closing ---------- */
  function closeAll() {
    var ui = elements();
    [ui.welcome, ui.consult, ui.privacy].forEach(function (d) { if (d && d.open) d.close(); });
  }

  function open(name, topic) {
    var ui = elements();
    if (name === 'none') { closeAll(); return; }
    var target = ui[name];
    if (!target) return;
    if (name !== 'welcome' && ui.welcome.open) ui.welcome.close();
    if (name === 'consult') {
      if (ui.consult.open) ui.consult.close();
      resetConsult();
      if (topic) ui.form.elements.message.value = 'I’d like to discuss ' + topic.toLowerCase() + '.';
    }
    if (!target.open) target.showModal();
  }

  function requestWelcome() {
    welcomePending = !hasSeenWelcome();
    maybeShowWelcome();
  }

  function maybeShowWelcome() {
    if (!welcomePending || welcomeHeld) return;
    welcomePending = false;
    open('welcome');
  }

  function setWelcomeHold(hold) {
    welcomeHeld = !!hold;
    maybeShowWelcome();
  }

  /* ---------- wiring ---------- */
  function wire() {
    var ui = elements();

    ui.form.addEventListener('change', updateContactPreference);
    ui.form.addEventListener('submit', function (event) {
      event.preventDefault();
      var errors = validate(ui.form);
      showErrors(ui.form, errors);
      if (Object.keys(errors).length === 0) showResult(ui.form);
    });

    ui.consult.addEventListener('close', resetConsult);
    ui.welcome.addEventListener('close', rememberWelcome);

    document.getElementById('welcome-consult').addEventListener('click', function () { open('consult'); });
    document.getElementById('welcome-explore').addEventListener('click', function () { ui.welcome.close(); });

    [ui.welcome, ui.consult, ui.privacy].forEach(function (dialog) {
      dialog.addEventListener('click', function (event) {
        // Clicking the dimmed area outside the window closes it.
        if (event.target === dialog) {
          var box = dialog.getBoundingClientRect();
          var outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
          if (outside) dialog.close();
        }
        var close = event.target.closest && event.target.closest('.close');
        if (close && dialog.contains(close)) dialog.close();
      });
    });

    ui.result.addEventListener('click', function (event) {
      if (event.target.closest('[data-result-edit]')) {
        ui.result.hidden = true;
        ui.form.hidden = false;
        ui.form.elements.name.focus();
      }
      if (event.target.closest('[data-result-done]')) ui.consult.close();
    });

    // Any element with these attributes opens a window, on every prototype.
    document.addEventListener('click', function (event) {
      var target = event.target.closest && event.target.closest('[data-consult],[data-service],[data-privacy]');
      if (!target) return;
      if (target.hasAttribute('data-privacy')) open('privacy');
      else open('consult', target.getAttribute('data-service') || '');
    });
  }

  function mount(options) {
    settings = {
      prototypeId: options.prototypeId,
      copy: options.copy
    };
    var holder = document.createElement('div');
    holder.innerHTML = buildMarkup();
    while (holder.firstChild) document.body.appendChild(holder.firstChild);
    wire();
    updateContactPreference();
  }

  window.ShawnDialogs = {
    mount: mount,
    open: open,
    closeAll: closeAll,
    requestWelcome: requestWelcome,
    setWelcomeHold: setWelcomeHold
  };
})();
