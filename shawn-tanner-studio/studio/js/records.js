// What one piece of feedback looks like, and how to clean anything that comes from outside.

import { findPrototype, designName, pageLabel, SITE_WIDE } from './config.js';
import { catalogItem } from './catalog.js';

export const DECISIONS = ['keep', 'change', 'remove'];
export const KINDS = ['element', 'page', 'design'];
export const LIMITS = { comment: 2000, label: 200, records: 3000 };

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,100}$/i;
const PROTOTYPE_PATTERN = /^[a-z][a-z0-9-]{0,20}$/i;
const PAGE_PATTERN = /^[a-z][a-z0-9-]{0,40}$/i;

export function makeKey(kind, prototypeId, pageId, elementId) {
  if (kind === 'element') return elementId;
  if (kind === 'page') return `page:${prototypeId}.${pageId}`;
  return `design:${prototypeId}`;
}

// The website "role" a record speaks about, regardless of which prototype it came from.
export function slotOfRecord(record) {
  if (record.kind === 'design') return 'design';
  if (record.kind === 'page') return `page:${record.pageId}`;
  const dot = record.elementId.indexOf('.');
  return dot < 0 ? record.elementId : record.elementId.slice(dot + 1);
}

export function isEmptyRecord(record) {
  return !record.decision && !record.favorite && !record.comment.trim();
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  // Remove control characters (keep tabs and line breaks) and cap the length.
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);
}

function cleanDate(value) {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** Returns { record } or { error } for anything untrusted. */
export function sanitizeRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'not an object' };
  const kind = raw.kind;
  if (KINDS.indexOf(kind) < 0) return { error: 'unknown kind' };
  if (typeof raw.prototypeId !== 'string' || !PROTOTYPE_PATTERN.test(raw.prototypeId)) return { error: 'bad prototype id' };

  let pageId = null;
  let elementId = null;
  if (kind === 'page' || kind === 'element') {
    if (typeof raw.pageId !== 'string' || !PAGE_PATTERN.test(raw.pageId)) return { error: 'bad page id' };
    pageId = raw.pageId;
  }
  if (kind === 'element') {
    if (typeof raw.elementId !== 'string' || !ID_PATTERN.test(raw.elementId)) return { error: 'bad element id' };
    elementId = raw.elementId;
    if (!elementId.startsWith(`${raw.prototypeId}.`)) return { error: 'element does not belong to prototype' };
  }
  if (raw.decision !== null && raw.decision !== undefined && DECISIONS.indexOf(raw.decision) < 0) return { error: 'unknown decision' };
  if (raw.favorite !== undefined && typeof raw.favorite !== 'boolean') return { error: 'favorite must be true or false' };
  if (raw.comment !== undefined && typeof raw.comment !== 'string') return { error: 'comment must be text' };

  const context = raw.context && typeof raw.context === 'object' && !Array.isArray(raw.context) ? raw.context : {};
  const rev = Number.isInteger(context.rev) && context.rev > 0 && context.rev < 10000 ? context.rev : 1;
  const record = {
    key: makeKey(kind, raw.prototypeId, pageId, elementId),
    kind,
    prototypeId: raw.prototypeId,
    pageId,
    elementId,
    decision: raw.decision || null,
    favorite: raw.favorite === true,
    comment: cleanText(raw.comment || '', LIMITS.comment),
    context: {
      designName: cleanText(context.designName, LIMITS.label),
      prototypeVersion: cleanText(context.prototypeVersion, 40),
      pageLabel: cleanText(context.pageLabel, LIMITS.label),
      elementLabel: cleanText(context.elementLabel, LIMITS.label),
      roleLabel: cleanText(context.roleLabel, LIMITS.label),
      rev
    },
    updatedAt: cleanDate(raw.updatedAt) || new Date().toISOString()
  };
  if (isEmptyRecord(record)) return { error: 'empty' };
  return { record };
}

/** Context snapshot kept with every note so it stays readable even if the prototype changes. */
export function buildContext(kind, prototypeId, pageId, elementId) {
  const proto = findPrototype(prototypeId);
  const item = elementId ? catalogItem(elementId) : null;
  return {
    designName: designName(prototypeId),
    prototypeVersion: proto ? proto.version : '',
    pageLabel: pageId ? pageLabel(pageId) : '',
    elementLabel: item ? item.label : '',
    roleLabel: item ? item.label : '',
    rev: item ? item.rev : 1
  };
}

export function describeRecord(record) {
  const context = record.context || {};
  const design = context.designName || designName(record.prototypeId);
  if (record.kind === 'design') return { design, page: 'Whole design', element: 'Overall look and feel', title: `${design} (whole design)` };
  const page = context.pageLabel || pageLabel(record.pageId);
  if (record.kind === 'page') return { design, page, element: 'Whole page', title: `${design} · ${page} (whole page)` };
  const item = catalogItem(record.elementId);
  const element = (item && item.label) || context.elementLabel || record.elementId;
  const pageText = record.pageId === SITE_WIDE.id ? SITE_WIDE.label : page;
  return { design, page: pageText, element, title: `${design} · ${pageText} · ${element}` };
}
