/* Prototype 1 — Warm coast. Content comes from ../shared/content.js; this file only arranges and presents it. */
(function () {
  'use strict';
  var content = window.ShawnContent;
  var esc = window.ShawnUtil.escapeHtml;
  var main = document.querySelector('main');
  var services = content.services;
  var id = function (suffix) { return 'p1.' + suffix; };

  var coast = `<svg viewBox="0 0 520 520" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustrated coastal marsh at sunrise"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#d8e3d8"/><stop offset="1" stop-color="#f4dfb7"/></linearGradient><linearGradient id="sea" x2="0" y2="1"><stop stop-color="#b7cbc3"/><stop offset="1" stop-color="#769990"/></linearGradient></defs><rect width="520" height="520" fill="url(#sky)"/><circle cx="348" cy="157" r="55" fill="#f5e6bd"/><path d="M0 235Q140 224 260 240T520 229V520H0" fill="url(#sea)"/><path d="M0 290Q130 231 272 285T520 272V321Q380 360 190 320T0 350Z" fill="#718d6d"/><path d="M0 339Q103 277 230 329T520 343V378Q340 398 212 355T0 396Z" fill="#b2b68b"/><path d="M0 407Q140 313 272 379T520 397V520H0" fill="#8e9c72"/><path d="M520 284Q300 309 350 340T255 383Q178 423 274 520H421Q242 435 333 401T403 342Q320 307 520 303" fill="#c6d7cc"/><path d="M0 463Q120 399 208 454T520 478V520H0" fill="#536e52"/><g fill="none" stroke="#e0c88c" stroke-width="2"><path d="M40 520q-6-90-18-119m20 70 20-49m-15 80 22-34M96 520q-2-60 16-128m-16 70-20-37m29 7 22-30M456 520q4-80 26-148m-18 96-17-35m28-24 20-31"/></g><g fill="none" stroke="#526e61" stroke-width="2"><path d="M90 155q10-10 20 0q10-10 20 0m-2 16q7-7 14 0q7-7 14 0"/></g></svg>`;

  function testimonial(item, number) {
    return '<article class="testimonial" data-review-id="' + id('home.testimonials.' + item.id) + '"><div class="quote-mark" aria-hidden="true">“</div><p>' + esc(item.quote) + '</p><small>' + esc(item.note) + '</small></article>';
  }

  function home() {
    return '<section class="hero" data-review-id="' + id('home.hero') + '"><div>' +
      '<p class="eyebrow">BIG-PICTURE EXPERIENCE. SMALL-BUSINESS CARE.</p>' +
      '<h1 data-review-id="' + id('home.hero.headline') + '">Your business.<br>Your ambition.<br><em>A little clarity.</em></h1>' +
      '<p class="intro" data-review-id="' + id('home.hero.text') + '">' + esc(content.introduction) + '</p>' +
      '<div class="hero-actions" data-review-id="' + id('home.hero.actions') + '"><button class="button" data-consult>Let’s start a conversation <span aria-hidden="true">↗</span></button><a class="text-button" href="#guide">Not sure what you need? →</a></div>' +
      '<div class="location" data-review-id="' + id('home.hero.locations') + '">' + content.locations.map(esc).join(' · ') + '</div></div>' +
      '<div class="coast-art" data-review-id="' + id('home.hero.visual') + '">' + coast + '<div class="art-caption"><strong>Good numbers. Clearer horizons.</strong>Accounting support, close to home.</div></div></section>' +

      '<section class="testimonials" data-review-id="' + id('home.testimonials') + '"><div class="section"><p class="eyebrow">THE PEOPLE BEHIND THE BUSINESSES</p><h2>Trust is personal.</h2><div class="testimonial-grid">' +
        content.testimonials.map(testimonial).join('') + '</div></div></section>' +

      '<div class="trust-strip" data-review-id="' + id('home.trust') + '">' + content.trustPoints.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +

      '<section class="section" data-review-id="' + id('home.services') + '"><div class="section-head"><div><p class="eyebrow">ROOM TO GROW. SUPPORT TO GET THERE.</p><h2>Find a little breathing room.</h2></div>' +
        '<div class="arrows" data-review-id="' + id('home.services.controls') + '"><button id="carousel-prev" aria-label="Previous services">←</button><button id="carousel-next" aria-label="Next services">→</button></div></div>' +
        '<div class="carousel" aria-label="Explore accounting services" tabindex="0" data-review-id="' + id('home.services.carousel') + '">' +
        services.map(function (s) {
          return '<article class="service-card" data-review-id="' + id('home.services.card.' + s.id) + '"><span class="icon" aria-hidden="true">' + s.icon + '</span><h3>' + esc(s.name) + '</h3><p>' + esc(s.short) + '</p><a href="#services/' + s.id + '">Explore this service ↗</a></article>';
        }).join('') + '</div></section>' +

      '<section class="section"><div class="guide-banner" data-review-id="' + id('home.guide-teaser') + '"><div><p class="eyebrow">NOT SURE WHERE TO START?</p><h2>Start with what’s on your mind.</h2><p>Two simple questions. A useful direction. No email required.</p></div><a class="button" href="#guide">Find my starting point <span aria-hidden="true">→</span></a></div></section>';
  }

  function servicesPage() {
    return '<div class="page-heading" data-review-id="' + id('services.intro') + '"><p class="eyebrow">SUPPORT THAT STARTS WITH YOUR BUSINESS</p><h1>Less guesswork.<br>More perspective.</h1><p>Explore possible areas of support, then talk through what fits. Your business, priorities and agreed scope shape the engagement.</p><p class="fine">' + esc(content.servicesNote) + '</p></div>' +
      '<div class="service-details" data-review-id="' + id('services.list') + '">' + services.map(function (s) {
        return '<article class="detail" id="' + s.id + '" data-review-id="' + id('services.detail.' + s.id) + '"><h2>' + esc(s.name) + '</h2><div><p>' + esc(s.description) + '</p><div class="benefit">' + esc(s.benefit) + '</div>' +
          '<p data-review-id="' + id('services.detail.' + s.id + '.bring') + '"><strong>A helpful starting point:</strong> ' + esc(s.prepare) + '</p>' +
          '<button class="text-button" data-service="' + esc(s.name) + '">Talk about ' + esc(s.name.toLowerCase()) + ' ↗</button></div></article>';
      }).join('') + '</div>';
  }

  var selectedNeed = null, selectedStage = null;

  function choiceButtons(list, attribute, selected) {
    return list.map(function (c) { return '<button class="choice" data-' + attribute + '="' + c.id + '" aria-pressed="' + (selected === c.id) + '">' + esc(c.label) + '</button>'; }).join('');
  }

  function guidePage() {
    var g = content.guide;
    return '<div class="page-heading" data-review-id="' + id('guide.intro') + '"><p class="eyebrow">YOUR ACCOUNTING STARTING POINT</p><h1>A little direction.<br>Before the conversation.</h1><p>Choose what sounds most like your business. You’ll get a practical next step without sharing your contact details.</p></div>' +
      '<div class="tool-layout"><div class="tool-card">' +
        '<div class="question" data-review-id="' + id('guide.need') + '"><p class="eyebrow">01 / WHAT’S ON YOUR MIND?</p><h2>Where would more clarity help?</h2><div class="choices">' + choiceButtons(g.needs, 'need', selectedNeed) + '</div></div>' +
        '<div class="question" data-review-id="' + id('guide.stage') + '"><p class="eyebrow">02 / WHERE ARE YOU TODAY?</p><h2>How would you describe your business?</h2><div class="choices">' + choiceButtons(g.stages, 'stage', selectedStage) + '</div></div>' +
        '<button class="text-button" id="reset-guide" data-review-id="' + id('guide.reset') + '">Start over ↺</button></div>' +
      '<aside class="result-card" id="guide-result" aria-live="polite" data-review-id="' + id('guide.result') + '"></aside></div>';
  }

  function updateGuide() {
    var area = document.querySelector('#guide-result');
    if (!area) return;
    var result = window.ShawnUtil.guideResult(selectedNeed, selectedStage);
    if (!result) {
      area.innerHTML = '<p class="eyebrow">YOUR NEXT STEP</p><h2>Clarity starts with a question.</h2><p>Choose an answer to both questions to see a suggested starting point.</p><p class="fine">This guide suggests a conversation topic. It does not provide individualized financial or tax advice.</p>';
      return;
    }
    var service = result.service;
    area.innerHTML = '<p class="eyebrow">A SUGGESTED STARTING POINT</p><h2>' + esc(service.name) + '</h2><p>' + esc(service.benefit) + '</p><p>' + esc(result.stageNote) + '</p><p><strong>For the first conversation:</strong><br>' + esc(service.prepare) + '</p>' +
      '<a class="text-button" href="#services/' + service.id + '">Learn about this support ↗</a><button class="button full" data-service="' + esc(service.name) + '">Discuss my starting point <span aria-hidden="true">↗</span></button><p class="fine">' + esc(content.guide.disclaimer) + '</p>';
  }

  function setupCarousel() {
    var carousel = document.querySelector('.carousel');
    if (!carousel) return;
    var previous = document.querySelector('#carousel-prev'), next = document.querySelector('#carousel-next');
    var update = function () { previous.disabled = carousel.scrollLeft < 5; next.disabled = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 5; };
    previous.onclick = function () { carousel.scrollBy({ left: -carousel.clientWidth * 0.8 }); };
    next.onclick = function () { carousel.scrollBy({ left: carousel.clientWidth * 0.8 }); };
    carousel.addEventListener('scroll', update, { passive: true });
    update();
  }

  var titles = { home: 'Small Business Accounting', services: 'Services', guide: 'Find Your Starting Point' };

  function route() {
    var path = window.location.hash.slice(1) || 'home';
    var page = path.split('/')[0];
    if (!titles[page]) page = 'home';
    main.innerHTML = page === 'services' ? servicesPage() : page === 'guide' ? guidePage() : home();
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      if (a.hash === '#' + page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = titles[page] + ' | Shawn Tanner';
    updateGuide();
    main.classList.remove('page-in'); void main.offsetWidth; main.classList.add('page-in');
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (path.indexOf('/') > 0) { var anchor = document.getElementById(path.split('/')[1]); if (anchor) anchor.scrollIntoView({ behavior: 'instant' }); }
    setupCarousel();
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.need) { selectedNeed = button.dataset.need; document.querySelectorAll('[data-need]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); }); updateGuide(); }
    if (button.dataset.stage) { selectedStage = button.dataset.stage; document.querySelectorAll('[data-stage]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); }); updateGuide(); }
    if (button.id === 'reset-guide') { selectedNeed = null; selectedStage = null; document.querySelectorAll('.choice').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); updateGuide(); }
  });

  window.ShawnDialogs.mount({
    prototypeId: 'p1',
    copy: {
      welcomeEyebrow: 'WELCOME. MAKE YOURSELF AT HOME.',
      welcomeTitle: ['What brings you', 'here today?'],
      welcomeBody: ['You don’t need to have it all figured out.', 'Let’s find a helpful place to start.'],
      welcomeArt: ['A little clarity', 'goes a long way.'],
      consultEyebrow: 'A CONVERSATION, NOT A COMMITMENT.',
      consultTitle: ['Let’s talk about', 'your business.']
    }
  });
  window.addEventListener('hashchange', route);
  route();
  window.ShawnDialogs.requestWelcome();
})();
