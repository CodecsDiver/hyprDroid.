// Builds the two downloads: a readable report and a structured file.
// Both are made right here in the browser. Nothing is uploaded.

import { PROTOTYPES, PAGES, SITE_WIDE, STUDIO_VERSION, REPORT_FORMAT, REPORT_FORMAT_VERSION, designName } from './config.js';
import { describeRecord } from './records.js';
import { findConflicts, findMixNotes, findNeedsDecision, findUnreviewed, groupFavoritesBySlot } from './analysis.js';
import { formatDate } from './dom.js';

const DECISION_WORDS = { keep: 'Keep', change: 'Change', remove: 'Remove' };

export function buildJson(store, now = new Date()) {
  return JSON.stringify({
    format: REPORT_FORMAT,
    formatVersion: REPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    studioVersion: STUDIO_VERSION,
    prototypes: PROTOTYPES.map((p) => ({ id: p.id, number: p.number, name: p.name, version: p.version })),
    pages: PAGES.map((p) => p.id),
    records: store.all().map((r) => ({
      kind: r.kind, prototypeId: r.prototypeId, pageId: r.pageId, elementId: r.elementId,
      decision: r.decision, favorite: r.favorite, comment: r.comment, context: r.context, updatedAt: r.updatedAt
    }))
  }, null, 2);
}

function quote(text) {
  return text.trim().split('\n').map((line) => `> ${line}`).join('\n');
}

function recordLine(record, store) {
  const info = describeRecord(record);
  const status = store.statusOf(record);
  const parts = [];
  if (record.decision) parts.push(`**${DECISION_WORDS[record.decision]}**`);
  if (record.favorite) parts.push('★ Favorite');
  let line = `- ${info.element}${parts.length ? ' — ' + parts.join(' · ') : ''}`;
  if (status === 'missing') line += '  _(no longer in the current version)_';
  if (status === 'changed') line += '  _(updated since this note was written)_';
  if (record.comment.trim()) line += `\n${quote(record.comment).split('\n').map((l) => '  ' + l).join('\n')}`;
  return line;
}

function summaryLine(title, record) {
  const parts = [];
  if (record.decision) parts.push(`**${DECISION_WORDS[record.decision]}**`);
  if (record.favorite) parts.push('★ Favorite');
  let line = `- ${title}${parts.length ? ' — ' + parts.join(' · ') : ''}`;
  if (record.comment.trim()) line += `\n${quote(record.comment).split('\n').map((l) => '  ' + l).join('\n')}`;
  return line;
}

export function buildReport(store, now = new Date()) {
  const records = store.all();
  const out = [];
  const count = (fn) => records.filter(fn).length;

  out.push('# Website review notes', '');
  out.push(`Review date: ${formatDate(now.toISOString())}`);
  out.push(`Report created: ${now.toLocaleString()}`);
  out.push(`Review studio version: ${STUDIO_VERSION}`);
  out.push('Designs reviewed:');
  PROTOTYPES.forEach((p) => out.push(`- ${designName(p.id)} (version ${p.version})`));
  out.push('', 'This report was made on the reviewer’s own device. Nothing was uploaded. The sample website forms never send or book anything.', '');

  out.push('## At a glance', '');
  out.push(`- Notes in total: ${records.length}`);
  out.push(`- Keep: ${count((r) => r.decision === 'keep')} · Change: ${count((r) => r.decision === 'change')} · Remove: ${count((r) => r.decision === 'remove')}`);
  out.push(`- Favorites: ${count((r) => r.favorite)}`);
  const conflicts = findConflicts(records);
  out.push(`- Needs a conversation: ${conflicts.length}`, '');

  const designRecords = records.filter((r) => r.kind === 'design');
  const pageRecords = records.filter((r) => r.kind === 'page');
  out.push('## Whole-design preferences', '');
  if (!designRecords.length) out.push('_None yet._');
  designRecords.forEach((r) => out.push(summaryLine(designName(r.prototypeId), r)));
  out.push('', '## Whole-page preferences', '');
  if (!pageRecords.length) out.push('_None yet._');
  pageRecords.forEach((r) => out.push(summaryLine(describeRecord(r).title.replace(' (whole page)', ''), r)));

  out.push('', '## Favorites: the mix so far', '');
  const groups = groupFavoritesBySlot(records);
  if (!groups.length) out.push('_No favorites chosen yet._');
  groups.forEach((group) => {
    const choices = group.records.map((r) => `${designName(r.prototypeId)}${r.comment.trim() ? ' (“' + r.comment.trim().replace(/\s+/g, ' ').slice(0, 120) + '”)' : ''}`);
    const flag = new Set(group.records.map((r) => r.prototypeId)).size > 1 ? '  ⚠ needs discussion' : '';
    out.push(`- ${group.title}: ${choices.join('  |  ')}${flag}`);
  });
  const mixNotes = findMixNotes(records);
  if (mixNotes.length) {
    out.push('', 'Combining these will take design work:');
    mixNotes.forEach((n) => out.push(`- ${n.message}`));
  }

  out.push('', '## Needs a conversation', '');
  if (!conflicts.length) out.push('_Nothing conflicts right now._');
  conflicts.forEach((c) => {
    out.push(`- **${c.title}** — ${c.message}`);
    c.records.forEach((r) => out.push(`  - ${designName(r.prototypeId)}: ${r.decision ? DECISION_WORDS[r.decision] : 'no choice'}${r.favorite ? ', favorite' : ''}${r.comment.trim() ? ' — “' + r.comment.trim().replace(/\s+/g, ' ').slice(0, 160) + '”' : ''}`));
  });

  out.push('', '## Needs another look', '');
  const attention = findNeedsDecision(records, store).filter((item) => item.kind !== 'conflict');
  if (!attention.length) out.push('_Nothing waiting._');
  attention.forEach((item) => out.push(`- **${item.title}** — ${item.reason}`));

  out.push('', '## Choices and comments by design', '');
  PROTOTYPES.forEach((proto) => {
    out.push(`### ${designName(proto.id)}`, '');
    const own = records.filter((r) => r.prototypeId === proto.id && r.kind === 'element');
    if (!own.length) { out.push('_No notes on individual parts yet._', ''); return; }
    [SITE_WIDE].concat(PAGES).forEach((page) => {
      const onPage = own.filter((r) => r.pageId === page.id);
      if (!onPage.length) return;
      out.push(`**${page.label}**`, '');
      onPage.forEach((r) => out.push(recordLine(r, store)));
      out.push('');
    });
    // Notes whose part no longer exists keep their own page label.
    const known = new Set([SITE_WIDE.id].concat(PAGES.map((p) => p.id)));
    const orphans = own.filter((r) => !known.has(r.pageId));
    if (orphans.length) { out.push('**Other**', ''); orphans.forEach((r) => out.push(recordLine(r, store))); out.push(''); }
  });

  out.push('## Not yet reviewed', '');
  findUnreviewed(records).forEach((design) => {
    out.push(`### ${designName(design.prototype.id)} — ${design.open} of ${design.total} parts have no note`, '');
    design.pages.forEach((page) => {
      if (!page.unreviewed.length) return;
      const names = page.unreviewed.map((item) => item.label);
      out.push(`- ${page.pageLabel}: ${names.length > 12 ? names.slice(0, 12).join('; ') + `; and ${names.length - 12} more` : names.join('; ')}`);
    });
    out.push('');
  });

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function downloadFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function dateStamp(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
