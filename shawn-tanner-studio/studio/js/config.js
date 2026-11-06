// Studio settings: which prototypes exist, their versions, and which pages they share.
// Bump a prototype's `version` when its design changes in a way a reviewer should notice.

export const STUDIO_VERSION = '1.0.0';
export const REPORT_FORMAT = 'shawn-tanner-website-review';
export const REPORT_FORMAT_VERSION = 1;

export const PROTOTYPES = [
  {
    id: 'p1', number: 1, name: 'Warm coast', version: '1.0.0',
    path: 'prototypes/p1/index.html',
    summary: 'Cream, sage and deep teal with elegant serif headings. A hero with a coastal picture, then services, testimonials and a guide invitation.'
  },
  {
    id: 'p2', number: 2, name: 'Conversation-first', version: '1.0.0',
    path: 'prototypes/p2/index.html',
    summary: 'Bright white with coral and sky blue, rounded shapes and friendly sans-serif type. Starts with “What’s on your mind?” and a step-by-step guide.'
  },
  {
    id: 'p3', number: 3, name: 'Service-first', version: '1.0.0',
    path: 'prototypes/p3/index.html',
    summary: 'Deep navy and brass with sturdy slab headings, a side menu and ledger-style tables. Puts the services up front.'
  }
];

export const PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'services', label: 'Services' },
  { id: 'guide', label: 'Starting-point guide' }
];

// Elements that appear on every page are filed under this page id.
export const SITE_WIDE = { id: 'site', label: 'Every page' };

export function findPrototype(id) {
  return PROTOTYPES.filter((p) => p.id === id)[0] || null;
}

export function pageLabel(pageId) {
  if (pageId === SITE_WIDE.id) return SITE_WIDE.label;
  const page = PAGES.filter((p) => p.id === pageId)[0];
  return page ? page.label : pageId;
}

export function designName(protoId) {
  const proto = findPrototype(protoId);
  return proto ? `Version ${proto.number} · ${proto.name}` : protoId;
}
