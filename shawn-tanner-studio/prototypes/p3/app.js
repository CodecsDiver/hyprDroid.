/* Prototype 3 — Service-first. Same business content as the others, arranged like an orderly ledger. */
(function () {
  'use strict';
  var content = window.ShawnContent;
  var kit = window.ShawnKit;
  var esc = window.ShawnUtil.escapeHtml;
  var main = document.querySelector('main');
  var id = function (suffix) { return 'p3.' + suffix; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  var ledgerArt = '<svg viewBox="0 0 420 340" role="img" aria-label="Illustration of a ledger page with columns of figures and a brass check mark">' +
    '<rect x="20" y="20" width="380" height="300" fill="#f7f4ea" stroke="#b48a3c" stroke-width="2"/>' +
    '<g stroke="#12263f" stroke-opacity=".25" stroke-width="2"><path d="M20 80H400M20 120H400M20 160H400M20 200H400M20 240H400M20 280H400"/></g>' +
    '<g stroke="#b48a3c" stroke-width="2"><path d="M230 20V320M320 20V320"/></g>' +
    '<g fill="#12263f" opacity=".7"><rect x="40" y="56" width="140" height="10"/><rect x="40" y="96" width="110" height="10"/><rect x="40" y="136" width="150" height="10"/><rect x="40" y="176" width="100" height="10"/><rect x="40" y="216" width="130" height="10"/><rect x="40" y="256" width="90" height="10"/>' +
    '<rect x="244" y="96" width="60" height="10"/><rect x="244" y="136" width="48" height="10"/><rect x="244" y="216" width="56" height="10"/><rect x="334" y="56" width="52" height="10"/><rect x="334" y="176" width="44" height="10"/><rect x="334" y="256" width="58" height="10"/></g>' +
    '<circle cx="326" cy="262" r="46" fill="#12263f"/><path d="M304 262l16 16 28-34" fill="none" stroke="#e0b95f" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function home() {
    return '<section class="hero" data-review-id="' + id('home.hero') + '"><div class="hero-copy">' +
        '<p class="eyebrow">Accounting support for small businesses</p>' +
        '<h1 data-review-id="' + id('home.hero.headline') + '">Clear numbers.<br>Confident decisions.</h1>' +
        '<p class="lead" data-review-id="' + id('home.hero.text') + '">' + esc(content.introduction) + '</p>' +
        '<div class="hero-actions" data-review-id="' + id('home.hero.actions') + '"><button class="button" data-consult>Let’s start a conversation</button><a class="text-link" href="#guide">Take the two-question guide →</a></div>' +
        '<p class="locations" data-review-id="' + id('home.hero.locations') + '">' + content.locations.map(esc).join(' <i>|</i> ') + '</p>' +
      '</div><div class="hero-visual" data-review-id="' + id('home.hero.visual') + '">' + ledgerArt + '</div></section>' +

      '<section class="testimonials" data-review-id="' + id('home.testimonials') + '"><h2 class="rule-title">Client references</h2><div class="ref-grid">' +
        content.testimonials.map(function (t, i) {
          return '<article class="reference" data-review-id="' + id('home.testimonials.' + t.id) + '"><p class="ref-no">Reference ' + pad(i + 1) + '</p><p class="quote">“' + esc(t.quote) + '”</p><p class="ref-note">' + esc(t.note) + '</p></article>';
        }).join('') + '</div></section>' +

      '<section class="services-section" data-review-id="' + id('home.services') + '"><div class="section-head"><div><p class="eyebrow">Services</p><h2 class="rule-title">' + pad(content.services.length) + ' areas of support</h2></div>' +
        '<div class="square-arrows" data-review-id="' + id('home.services.controls') + '"><button id="carousel-prev" aria-label="Previous services">←</button><button id="carousel-next" aria-label="Next services">→</button></div></div>' +
        '<div class="carousel" tabindex="0" aria-label="Explore accounting services" data-review-id="' + id('home.services.carousel') + '">' +
          content.services.map(function (s, i) {
            return '<article class="service-card" data-review-id="' + id('home.services.card.' + s.id) + '"><span class="num" aria-hidden="true">' + pad(i + 1) + '</span><h3>' + esc(s.name) + '</h3><p>' + esc(s.short) + '</p><a class="text-link" href="#services/' + s.id + '">Details →</a></article>';
          }).join('') + '</div></section>' +

      '<section class="trust-ledger" data-review-id="' + id('home.trust') + '">' + content.trustPoints.map(function (t, i) { return '<div><b>' + String.fromCharCode(65 + i) + '</b><span>' + esc(t) + '</span></div>'; }).join('') + '</section>' +

      '<section class="teaser" data-review-id="' + id('home.guide-teaser') + '"><div><p class="eyebrow">Not sure where to start?</p><h2>Two questions. A useful direction.</h2></div><a class="button" href="#guide">Find my starting point</a></section>';
  }

  function servicesPage() {
    return '<section class="page-intro" data-review-id="' + id('services.intro') + '"><p class="eyebrow">Services</p><h1>Support that starts with your business.</h1><p class="lead">Explore possible areas of support, then talk through what fits. Your business, priorities and agreed scope shape the engagement.</p><p class="fine">' + esc(content.servicesNote) + '</p></section>' +
      '<div class="ledger" data-review-id="' + id('services.list') + '"><div class="ledger-head" aria-hidden="true"><span>Support</span><span>How it can help</span><span>Bring to the first conversation</span></div>' +
      content.services.map(function (s, i) {
        return '<article class="ledger-row" id="' + s.id + '" data-review-id="' + id('services.detail.' + s.id) + '">' +
          '<div class="cell name"><span class="num" aria-hidden="true">' + pad(i + 1) + '</span><h2>' + esc(s.name) + '</h2><button class="text-link" data-service="' + esc(s.name) + '">Talk about this →</button></div>' +
          '<div class="cell help"><p>' + esc(s.description) + '</p><p class="benefit">' + esc(s.benefit) + '</p></div>' +
          '<div class="cell bring" data-review-id="' + id('services.detail.' + s.id + '.bring') + '"><p class="mobile-label">Bring to the first conversation</p><p>' + esc(s.prepare) + '</p></div></article>';
      }).join('') + '</div>';
  }

  var selectedNeed = null, selectedStage = null;

  function radios(list, name, selected) {
    return list.map(function (c) {
      return '<label class="option"><input type="radio" name="' + name + '" value="' + c.id + '"' + (selected === c.id ? ' checked' : '') + '><span>' + esc(c.label) + '</span></label>';
    }).join('');
  }

  function guidePage() {
    var g = content.guide;
    return '<section class="page-intro" data-review-id="' + id('guide.intro') + '"><p class="eyebrow">Starting-point guide</p><h1>A little direction before the conversation.</h1><p class="lead">Complete both sections for a practical next step. You do not need to share any contact details.</p></section>' +
      '<div class="worksheet"><form class="sheet">' +
        '<fieldset class="section-a" data-review-id="' + id('guide.need') + '"><legend><b>A</b> Where would more clarity help?</legend>' + radios(g.needs, 'need', selectedNeed) + '</fieldset>' +
        '<fieldset class="section-b" data-review-id="' + id('guide.stage') + '"><legend><b>B</b> How would you describe your business?</legend>' + radios(g.stages, 'stage', selectedStage) + '</fieldset>' +
        '<button type="button" class="text-link" id="reset-guide" data-review-id="' + id('guide.reset') + '">↺ Clear the worksheet</button></form>' +
      '<aside class="summary-sheet" id="guide-result" aria-live="polite" data-review-id="' + id('guide.result') + '"></aside></div>';
  }

  function updateGuide() {
    var area = document.querySelector('#guide-result');
    if (!area) return;
    var result = window.ShawnUtil.guideResult(selectedNeed, selectedStage);
    if (!result) {
      area.innerHTML = '<p class="eyebrow">Summary sheet</p><h2>Awaiting your answers</h2><p>Choose one answer in section A and one in section B to see a suggested starting point.</p><p class="fine">This guide suggests a conversation topic. It does not provide individualized financial or tax advice.</p>';
      return;
    }
    var service = result.service;
    area.innerHTML = '<p class="eyebrow">Summary sheet · suggested starting point</p><h2>' + esc(service.name) + '</h2>' +
      '<dl><dt>How it can help</dt><dd>' + esc(service.benefit) + '</dd><dt>For your situation</dt><dd>' + esc(result.stageNote) + '</dd><dt>Bring to the first conversation</dt><dd>' + esc(service.prepare) + '</dd></dl>' +
      '<div class="cta-row"><button class="button" data-service="' + esc(service.name) + '">Discuss my starting point</button><a class="text-link" href="#services/' + service.id + '">Learn about this support →</a></div>' +
      '<p class="fine">' + esc(content.guide.disclaimer) + '</p>';
  }

  var titles = { home: 'Small Business Accounting', services: 'Services', guide: 'Find Your Starting Point' };

  function route() {
    var r = kit.readRoute();
    main.innerHTML = r.page === 'services' ? servicesPage() : r.page === 'guide' ? guidePage() : home();
    kit.markCurrentLink('.nav-links a', r.page);
    document.title = titles[r.page] + ' | Shawn Tanner';
    updateGuide();
    kit.animatePage(main);
    kit.scrollToTopOrAnchor(r.anchor);
    kit.setupCarousel('.carousel', '#carousel-prev', '#carousel-next');
  }

  document.addEventListener('change', function (event) {
    var input = event.target;
    if (input.name === 'need') selectedNeed = input.value;
    if (input.name === 'stage') selectedStage = input.value;
    if (input.name === 'need' || input.name === 'stage') updateGuide();
  });
  document.addEventListener('click', function (event) {
    var button = event.target.closest('#reset-guide');
    if (button) { selectedNeed = null; selectedStage = null; document.querySelectorAll('.option input').forEach(function (i) { i.checked = false; }); updateGuide(); }
  });

  window.ShawnDialogs.mount({
    prototypeId: 'p3',
    copy: {
      welcomeEyebrow: 'Welcome',
      welcomeTitle: ['How can we', 'help today?'],
      welcomeBody: ['Take your time. You can look around without sharing anything.', 'When you are ready, an expert is a conversation away.'],
      welcomeArt: ['Clear numbers.', 'Confident decisions.'],
      consultEyebrow: 'Consultation request',
      consultTitle: ['Tell us about', 'your business.']
    }
  });
  window.addEventListener('hashchange', route);
  route();
  window.ShawnDialogs.requestWelcome();
})();
