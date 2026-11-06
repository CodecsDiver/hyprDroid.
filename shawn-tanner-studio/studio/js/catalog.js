// The list of reviewable parts of every prototype.
// Each prototype page must contain every item below (tools/check-catalog.mjs verifies this).
// An element id is "<prototype>.<suffix>", for example "p2.home.hero".
// Review data stays out of the prototypes: labels live here, ids live in the markup.

import { PROTOTYPES } from './config.js';

const content = window.ShawnContent;

// [suffix, label]. The page is the first part of the suffix.
function baseItems() {
  const items = [
    ['site.nav', 'Navigation bar'],
    ['site.nav.brand', 'Logo and name'],
    ['site.nav.links', 'Menu links'],
    ['site.nav.consult', '“Let’s talk” button'],
    ['site.footer', 'Footer'],
    ['site.footer.privacy', 'Privacy link'],
    ['site.welcome', 'Welcome window'],
    ['site.welcome.art', 'Welcome window artwork'],
    ['site.welcome.consult', 'Welcome: “Schedule an expert’s free consultation” choice'],
    ['site.welcome.explore', 'Welcome: “I’m still deciding” choice'],
    ['site.consult', 'Consultation window'],
    ['site.consult.details', 'Consultation: name and business'],
    ['site.consult.contact-preference', 'Consultation: how to connect (email or phone)'],
    ['site.consult.contact-fields', 'Consultation: email and phone fields'],
    ['site.consult.time-picker', 'Consultation: sample time choices'],
    ['site.consult.message', 'Consultation: message box'],
    ['site.consult.consent', 'Consultation: permission checkbox'],
    ['site.consult.submit', 'Consultation: send button'],
    ['site.consult.notice', 'Consultation: demo notice'],
    ['site.consult.result', 'Consultation: confirmation (shown after sending the sample)'],
    ['site.privacy', 'Privacy window'],

    ['home.hero', 'Main introduction'],
    ['home.hero.headline', 'Headline'],
    ['home.hero.text', 'Introduction text'],
    ['home.hero.actions', 'Introduction buttons'],
    ['home.hero.locations', 'Service-area line'],
    ['home.hero.visual', 'Main picture'],
    ['home.trust', 'Trust points'],
    ['home.testimonials', 'Testimonials area'],
    ['home.testimonials.one', 'Testimonial 1 (placeholder)'],
    ['home.testimonials.two', 'Testimonial 2 (placeholder)'],
    ['home.services', 'Services section'],
    ['home.services.carousel', 'Scrolling row of service cards'],
    ['home.services.controls', 'Left and right arrow buttons']
  ];
  content.services.forEach((service) => items.push([`home.services.card.${service.id}`, `Service card: ${service.name}`]));
  items.push(
    ['home.guide-teaser', 'Starting-point guide invitation'],

    ['services.intro', 'Page introduction'],
    ['services.list', 'List of services']
  );
  content.services.forEach((service) => {
    items.push([`services.detail.${service.id}`, `Service: ${service.name}`]);
    items.push([`services.detail.${service.id}.bring`, `What to bring: ${service.name}`]);
  });
  items.push(
    ['guide.intro', 'Page introduction'],
    ['guide.need', 'Question 1: what’s on your mind'],
    ['guide.stage', 'Question 2: where you are today'],
    ['guide.reset', 'Start over button'],
    ['guide.result', 'Suggested starting point']
  );
  return items;
}

// Bump a revision when the content of an item changes enough that earlier notes should be re-read.
const REVISIONS = {};

const base = baseItems();

export function catalogFor(prototypeId) {
  return base.map(([suffix, label]) => ({
    id: `${prototypeId}.${suffix}`,
    prototypeId,
    suffix,
    page: suffix.split('.')[0],
    label,
    rev: REVISIONS[`${prototypeId}.${suffix}`] || 1
  }));
}

const byId = new Map();
PROTOTYPES.forEach((proto) => catalogFor(proto.id).forEach((item) => byId.set(item.id, item)));

export function catalogItem(elementId) {
  return byId.get(elementId) || null;
}

export function catalogPage(prototypeId, pageId) {
  return catalogFor(prototypeId).filter((item) => item.page === pageId);
}

export function labelMapFor(prototypeId) {
  const map = {};
  catalogFor(prototypeId).forEach((item) => { map[item.id] = item.label; });
  return map;
}

// "home.hero" is the same website role no matter which prototype it comes from.
export function slotOf(elementId) {
  const dot = elementId.indexOf('.');
  return dot < 0 ? elementId : elementId.slice(dot + 1);
}

export function prototypeOf(elementId) {
  const dot = elementId.indexOf('.');
  return dot < 0 ? '' : elementId.slice(0, dot);
}
