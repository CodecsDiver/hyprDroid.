/* Prototype 2 — Conversation-first. Same business content as the others, presented as a friendly conversation. */
(function () {
  'use strict';
  var content = window.ShawnContent;
  var kit = window.ShawnKit;
  var esc = window.ShawnUtil.escapeHtml;
  var main = document.querySelector('main');
  var id = function (suffix) { return 'p2.' + suffix; };
  var tints = ['sky', 'coral', 'sun', 'mint', 'lilac'];

  var heroArt = '<svg viewBox="0 0 520 440" role="img" aria-label="Friendly illustration of a conversation bubble beside a rising bar chart">' +
    '<rect width="520" height="440" rx="56" fill="#dff1fb"/><circle cx="420" cy="96" r="66" fill="#ffe8a3"/><circle cx="90" cy="360" r="96" fill="#fde8e3"/>' +
    '<g transform="translate(64 62)"><rect width="270" height="128" rx="38" fill="#fff"/><path d="M62 124 38 172 112 124Z" fill="#fff"/>' +
    '<circle cx="78" cy="64" r="12" fill="#c8432f"/><circle cx="135" cy="64" r="12" fill="#1f6f9a"/><circle cx="192" cy="64" r="12" fill="#e5b229"/></g>' +
    '<g><rect x="238" y="316" width="52" height="72" rx="16" fill="#1f6f9a"/><rect x="306" y="262" width="52" height="126" rx="16" fill="#c8432f"/><rect x="374" y="206" width="52" height="182" rx="16" fill="#22252b"/>' +
    '<rect x="222" y="392" width="224" height="8" rx="4" fill="#22252b" opacity=".18"/></g></svg>';

  function home() {
    var g = content.guide;
    return '<section class="hero" data-review-id="' + id('home.hero') + '"><div class="hero-copy">' +
        '<p class="kicker">Hello, and welcome</p>' +
        '<h1 data-review-id="' + id('home.hero.headline') + '">What’s on your mind?</h1>' +
        '<p class="lead" data-review-id="' + id('home.hero.text') + '">' + esc(content.introduction) + '</p>' +
        '<div class="hero-actions" data-review-id="' + id('home.hero.actions') + '"><p class="chips-label">Pick what sounds closest:</p><div class="chips">' +
          g.needs.map(function (n) { return '<a class="chip" href="#guide" data-need-link="' + n.id + '">' + esc(n.label) + '</a>'; }).join('') + '</div>' +
          '<div class="cta-row"><button class="button" data-consult>Let’s start a conversation</button><a class="link-pill" href="#guide">Or try the starting-point guide →</a></div></div>' +
        '<ul class="place-pills" data-review-id="' + id('home.hero.locations') + '" aria-label="Where we help">' + content.locations.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' +
      '</div><div class="hero-visual" data-review-id="' + id('home.hero.visual') + '">' + heroArt + '</div></section>' +

      '<section class="testimonials" data-review-id="' + id('home.testimonials') + '"><h2 class="section-title">Kind words, when they arrive</h2><div class="bubble-row">' +
        content.testimonials.map(function (t, i) {
          return '<article class="bubble tint-' + (i ? 'mint' : 'sun') + '" data-review-id="' + id('home.testimonials.' + t.id) + '"><p class="quote">“' + esc(t.quote) + '”</p><p class="bubble-note">' + esc(t.note) + '</p></article>';
        }).join('') + '</div></section>' +

      '<section class="services-band" data-review-id="' + id('home.services') + '"><div class="band-head"><div><p class="kicker">Ways we can help</p><h2 class="section-title">Pick a place to start</h2></div>' +
        '<div class="round-arrows" data-review-id="' + id('home.services.controls') + '"><button id="carousel-prev" aria-label="Previous services">←</button><button id="carousel-next" aria-label="Next services">→</button></div></div>' +
        '<div class="carousel" tabindex="0" aria-label="Explore accounting services" data-review-id="' + id('home.services.carousel') + '">' +
          content.services.map(function (s, i) {
            return '<article class="service-card tint-' + tints[i % tints.length] + '" data-review-id="' + id('home.services.card.' + s.id) + '"><span class="icon" aria-hidden="true">' + s.icon + '</span><h3>' + esc(s.name) + '</h3><p>' + esc(s.short) + '</p><a class="link-pill" href="#services/' + s.id + '">Explore →</a></article>';
          }).join('') + '</div></section>' +

      '<ul class="trust-pills" data-review-id="' + id('home.trust') + '">' + content.trustPoints.map(function (t) { return '<li><span aria-hidden="true">✓</span> ' + esc(t) + '</li>'; }).join('') + '</ul>' +

      '<section class="teaser" data-review-id="' + id('home.guide-teaser') + '"><div><h2>Not sure where to start?</h2><p>Answer two friendly questions and get a useful direction. No email needed.</p></div><a class="button light" href="#guide">Find my starting point</a></section>';
  }

  function servicesPage() {
    return '<section class="page-intro" data-review-id="' + id('services.intro') + '"><p class="kicker">Ways we can help</p><h1>Support that starts with your business.</h1><p class="lead">Explore possible areas of support, then talk through what fits. Your business, priorities and agreed scope shape everything.</p><p class="fine">' + esc(content.servicesNote) + '</p></section>' +
      '<div class="service-grid" data-review-id="' + id('services.list') + '">' + content.services.map(function (s, i) {
        return '<article class="service-panel tint-' + tints[i % tints.length] + '" id="' + s.id + '" data-review-id="' + id('services.detail.' + s.id) + '"><header><span class="icon" aria-hidden="true">' + s.icon + '</span><h2>' + esc(s.name) + '</h2></header>' +
          '<p>' + esc(s.description) + '</p><p class="why"><strong>Why it can help:</strong> ' + esc(s.benefit) + '</p>' +
          '<div class="bring" data-review-id="' + id('services.detail.' + s.id + '.bring') + '"><strong>Bring to a first chat</strong><span>' + esc(s.prepare) + '</span></div>' +
          '<button class="button small" data-service="' + esc(s.name) + '">Talk about this</button></article>';
      }).join('') + '</div>';
  }

  var selectedNeed = null, selectedStage = null;

  function answers(list, attribute, selected) {
    return list.map(function (c) { return '<button class="answer" data-' + attribute + '="' + c.id + '" aria-pressed="' + (selected === c.id) + '">' + esc(c.label) + '</button>'; }).join('');
  }

  function guidePage() {
    var g = content.guide;
    return '<section class="page-intro" data-review-id="' + id('guide.intro') + '"><p class="kicker">Your accounting starting point</p><h1>Let’s find a good place to begin.</h1><p class="lead">Two quick questions, then a practical next step. You don’t need to share any contact details.</p></section>' +
      '<div class="chat">' +
        '<div class="chat-turn" data-review-id="' + id('guide.need') + '"><p class="step-count">Question 1 of 2</p><div class="ask"><span class="avatar" aria-hidden="true">ST</span><p>What’s on your mind?</p></div><div class="answers">' + answers(g.needs, 'need', selectedNeed) + '</div></div>' +
        '<div class="chat-turn" data-review-id="' + id('guide.stage') + '"><p class="step-count">Question 2 of 2</p><div class="ask"><span class="avatar" aria-hidden="true">ST</span><p>And where is your business today?</p></div><div class="answers">' + answers(g.stages, 'stage', selectedStage) + '</div></div>' +
        '<div class="chat-turn reply" id="guide-result" aria-live="polite" data-review-id="' + id('guide.result') + '"></div>' +
        '<button class="link-pill" id="reset-guide" data-review-id="' + id('guide.reset') + '">↺ Start over</button>' +
      '</div>';
  }

  function updateGuide() {
    var area = document.querySelector('#guide-result');
    if (!area) return;
    var result = window.ShawnUtil.guideResult(selectedNeed, selectedStage);
    if (!result) {
      area.innerHTML = '<div class="ask"><span class="avatar" aria-hidden="true">ST</span><div><p><strong>Your next step will show up here.</strong></p><p>Choose an answer to both questions and I’ll suggest a place to start.</p><p class="fine">This guide suggests a conversation topic. It does not provide individualized financial or tax advice.</p></div></div>';
      return;
    }
    var service = result.service;
    area.innerHTML = '<div class="ask"><span class="avatar" aria-hidden="true">ST</span><div><p class="kicker">A suggested starting point</p><h2>' + esc(service.name) + '</h2><p>' + esc(service.benefit) + '</p><p>' + esc(result.stageNote) + '</p>' +
      '<p class="bring-inline"><strong>For your first conversation:</strong> ' + esc(service.prepare) + '</p>' +
      '<div class="cta-row"><button class="button" data-service="' + esc(service.name) + '">Discuss my starting point</button><a class="link-pill" href="#services/' + service.id + '">Learn about this support →</a></div>' +
      '<p class="fine">' + esc(content.guide.disclaimer) + '</p></div></div>';
  }

  var titles = { home: 'Small Business Accounting', services: 'Services', guide: 'Find Your Starting Point' };

  function route() {
    var r = kit.readRoute();
    main.innerHTML = r.page === 'services' ? servicesPage() : r.page === 'guide' ? guidePage() : home();
    kit.markCurrentLink('.pill-links a', r.page);
    document.title = titles[r.page] + ' | Shawn Tanner';
    updateGuide();
    kit.animatePage(main);
    kit.scrollToTopOrAnchor(r.anchor);
    kit.setupCarousel('.carousel', '#carousel-prev', '#carousel-next');
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest('[data-need-link]');
    if (link) { selectedNeed = link.getAttribute('data-need-link'); selectedStage = null; }
    var button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.need) { selectedNeed = button.dataset.need; document.querySelectorAll('[data-need]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); }); updateGuide(); }
    if (button.dataset.stage) { selectedStage = button.dataset.stage; document.querySelectorAll('[data-stage]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); }); updateGuide(); }
    if (button.id === 'reset-guide') { selectedNeed = null; selectedStage = null; document.querySelectorAll('.answer').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); updateGuide(); }
  });

  window.ShawnDialogs.mount({
    prototypeId: 'p2',
    copy: {
      welcomeEyebrow: 'Hello there',
      welcomeTitle: ['What brings you', 'by today?'],
      welcomeBody: ['No pressure and no forms to fill in.', 'Take a look around, or chat with an expert.'],
      welcomeArt: ['Good to', 'meet you.'],
      consultEyebrow: 'Let’s chat',
      consultTitle: ['Tell us a little', 'about your business.']
    }
  });
  window.addEventListener('hashchange', route);
  route();
  window.ShawnDialogs.requestWelcome();
})();
