// Works out what still needs a decision. Nothing here changes the reviewer's notes.

import { PROTOTYPES, PAGES, SITE_WIDE, designName, pageLabel } from './config.js';
import { catalogFor } from './catalog.js';
import { slotOfRecord, describeRecord } from './records.js';

function slotTitle(slot) {
  if (slot === 'design') return 'The overall design';
  if (slot.startsWith('page:')) return `The ${pageLabel(slot.slice(5))} page`;
  const sample = catalogFor(PROTOTYPES[0].id).filter((item) => item.suffix === slot)[0];
  return sample ? sample.label : slot;
}

function protoNumbers(records) {
  const ids = Array.from(new Set(records.map((r) => r.prototypeId)));
  return ids.map((id) => designName(id)).join(' and ');
}

/**
 * Preferences that cannot all be true at once. Both sides are kept; nothing is erased.
 */
export function findConflicts(records) {
  const conflicts = [];
  const bySlot = new Map();
  records.forEach((record) => {
    const slot = slotOfRecord(record);
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot).push(record);
  });

  bySlot.forEach((group, slot) => {
    const favorites = group.filter((r) => r.favorite);
    const favoriteDesigns = new Set(favorites.map((r) => r.prototypeId));
    if (favoriteDesigns.size > 1) {
      conflicts.push({
        id: `fav:${slot}`, type: 'favorite',
        title: slotTitle(slot),
        message: `Favorites chosen from ${protoNumbers(favorites)} for the same part of the website. Only one can be used, so this needs a conversation.`,
        records: favorites
      });
    }
    const kept = group.filter((r) => r.decision === 'keep');
    const removed = group.filter((r) => r.decision === 'remove');
    const mismatch = kept.some((k) => removed.some((r) => r.prototypeId !== k.prototypeId));
    if (mismatch) {
      conflicts.push({
        id: `mix:${slot}`, type: 'mixed',
        title: slotTitle(slot),
        message: 'Kept in one design but marked for removal in another. Worth deciding whether this belongs on the website at all.',
        records: kept.concat(removed)
      });
    }
  });

  records.forEach((record) => {
    if (record.favorite && record.decision === 'remove') {
      conflicts.push({
        id: `self:${record.key}`, type: 'contradiction',
        title: describeRecord(record).title,
        message: 'Marked as a favorite and also marked Remove. Which did you mean?',
        records: [record]
      });
    }
  });
  return conflicts;
}

/** Favorites from different designs that overlap (a whole page plus a part of that page). Information only. */
export function findMixNotes(records) {
  const notes = [];
  const pageFavorites = records.filter((r) => r.favorite && r.kind === 'page');
  const elementFavorites = records.filter((r) => r.favorite && r.kind === 'element');
  pageFavorites.forEach((page) => {
    elementFavorites.forEach((element) => {
      if (element.prototypeId !== page.prototypeId && element.pageId === page.pageId) {
        notes.push({
          page, element,
          message: `${designName(page.prototypeId)}’s ${pageLabel(page.pageId)} page and ${designName(element.prototypeId)}’s ${describeRecord(element).element.toLowerCase()} overlap. They can be combined, but it takes design work.`
        });
      }
    });
  });
  return notes;
}

/** Items that still need the reviewer’s attention, with a plain reason. */
export function findNeedsDecision(records, store) {
  const items = [];
  findConflicts(records).forEach((conflict) => items.push({ kind: 'conflict', title: conflict.title, reason: conflict.message, records: conflict.records }));
  records.forEach((record) => {
    const status = store.statusOf(record);
    if (status === 'missing') {
      items.push({ kind: 'missing', title: describeRecord(record).title, reason: 'This part is no longer in the current version of the website. Your note is kept as it was. Decide whether it still applies.', records: [record] });
    } else if (status === 'changed') {
      items.push({ kind: 'changed', title: describeRecord(record).title, reason: 'This part was updated after you wrote your note. Please look again and confirm your choice.', records: [record] });
    }
    if (record.decision === 'change' && !record.comment.trim()) {
      items.push({ kind: 'incomplete', title: describeRecord(record).title, reason: 'You chose Change but haven’t said what to change yet.', records: [record] });
    }
    if (!record.decision && !record.favorite && record.comment.trim()) {
      items.push({ kind: 'undecided', title: describeRecord(record).title, reason: 'There is a note but no Keep, Change or Remove choice yet.', records: [record] });
    }
  });
  return items;
}

/** For every design and page: which parts have no note at all. */
export function findUnreviewed(records) {
  const reviewed = new Set(records.map((r) => r.key));
  return PROTOTYPES.map((proto) => {
    const pages = [SITE_WIDE].concat(PAGES).map((page) => {
      const all = catalogFor(proto.id).filter((item) => item.page === page.id);
      const open = all.filter((item) => !reviewed.has(item.id));
      return { pageId: page.id, pageLabel: page.label, total: all.length, unreviewed: open };
    });
    const total = pages.reduce((sum, p) => sum + p.total, 0);
    const open = pages.reduce((sum, p) => sum + p.unreviewed.length, 0);
    return { prototype: proto, pages, total, open };
  });
}

/** Favorites grouped by website role, for the “mix” view. */
export function groupFavoritesBySlot(records) {
  const groups = new Map();
  records.filter((r) => r.favorite).forEach((record) => {
    const slot = slotOfRecord(record);
    if (!groups.has(slot)) groups.set(slot, []);
    groups.get(slot).push(record);
  });
  return Array.from(groups.entries()).map(([slot, list]) => ({ slot, title: slotTitle(slot), records: list }));
}

export function markFor(record) {
  if (!record) return null;
  if (record.decision && record.favorite) return `${record.decision}-favorite`;
  if (record.decision) return record.decision;
  if (record.favorite) return 'favorite';
  return null;
}
