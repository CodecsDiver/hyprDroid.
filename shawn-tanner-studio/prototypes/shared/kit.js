/*
 * Small behaviours every prototype uses the same way: reading the page from the
 * address, the service carousel, and the gentle page-change transition.
 * The look of each of these is decided by each prototype's own CSS.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.ShawnKit = {
    pages: ['home', 'services', 'guide'],

    /** "#services/tax" -> { page: 'services', anchor: 'tax' } */
    readRoute: function () {
      var path = window.location.hash.slice(1) || 'home';
      var parts = path.split('/');
      var page = window.ShawnKit.pages.indexOf(parts[0]) >= 0 ? parts[0] : 'home';
      return { page: page, anchor: parts[1] || '' };
    },

    markCurrentLink: function (linkSelector, page) {
      document.querySelectorAll(linkSelector).forEach(function (link) {
        if (link.hash === '#' + page) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
      });
    },

    /** Fade the new page in. Skipped automatically for people who prefer less motion (CSS also handles it). */
    animatePage: function (main) {
      main.classList.remove('page-in');
      void main.offsetWidth;
      main.classList.add('page-in');
    },

    scrollToTopOrAnchor: function (anchor) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (anchor) {
        var target = document.getElementById(anchor);
        if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    },

    /** Horizontal carousel: arrow buttons plus native touch and keyboard scrolling. */
    setupCarousel: function (carouselSelector, previousSelector, nextSelector) {
      var carousel = document.querySelector(carouselSelector);
      var previous = document.querySelector(previousSelector);
      var next = document.querySelector(nextSelector);
      if (!carousel || !previous || !next) return;
      var step = function () { return Math.max(240, carousel.clientWidth * 0.8); };
      var behavior = reduceMotion ? 'auto' : 'smooth';
      var update = function () {
        previous.disabled = carousel.scrollLeft < 5;
        next.disabled = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 5;
      };
      previous.addEventListener('click', function () { carousel.scrollBy({ left: -step(), behavior: behavior }); });
      next.addEventListener('click', function () { carousel.scrollBy({ left: step(), behavior: behavior }); });
      carousel.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      update();
    }
  };
})();
