// Reads a notes file back in. Everything in the file is treated as untrusted text:
// it is checked first, previewed, and only then merged or used to replace notes.

import { REPORT_FORMAT, REPORT_FORMAT_VERSION } from './config.js';
import { sanitizeRecord, LIMITS } from './records.js';
import { sameContent } from './store.js';

export const MAX_IMPORT_BYTES = 1024 * 1024; // 1 MB is far more than any real review

export function readAndCheck(text, byteSize) {
  const problems = [];
  if (byteSize > MAX_IMPORT_BYTES) return { ok: false, problems: ['This file is larger than 1 MB, which is far bigger than a normal notes file. It was not opened.'] };

  let data;
  try { data = JSON.parse(text); } catch (error) { return { ok: false, problems: ['This file isn’t a notes file this studio can read (it isn’t valid JSON).'] }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, problems: ['This file doesn’t look like a notes file.'] };
  if (data.format !== REPORT_FORMAT) return { ok: false, problems: ['This isn’t a notes file from this review studio.'] };
  if (!Number.isInteger(data.formatVersion) || data.formatVersion < 1) return { ok: false, problems: ['The file doesn’t say which notes format it uses.'] };
  if (data.formatVersion > REPORT_FORMAT_VERSION) return { ok: false, problems: ['This file was made by a newer version of the studio. Update the studio before importing it.'] };
  if (!Array.isArray(data.records)) return { ok: false, problems: ['The file has no list of notes.'] };
  if (data.records.length > LIMITS.records) return { ok: false, problems: [`The file has more than ${LIMITS.records} notes, which is more than expected. It was not opened.`] };

  const records = [];
  const seen = new Set();
  let skipped = 0;
  data.records.forEach((raw) => {
    const result = sanitizeRecord(raw);
    if (result.record) {
      if (seen.has(result.record.key)) { skipped += 1; return; }
      seen.add(result.record.key);
      records.push(result.record);
    } else if (result.error !== 'empty') {
      skipped += 1;
    }
  });
  if (skipped) problems.push(`${skipped} item${skipped === 1 ? ' in the file was' : 's in the file were'} not valid and will be left out.`);
  if (!records.length) return { ok: false, problems: problems.concat('There are no usable notes in this file.') };
  return {
    ok: true,
    problems,
    records,
    meta: { exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null, studioVersion: typeof data.studioVersion === 'string' ? data.studioVersion.slice(0, 40) : null }
  };
}

/** Compare the file with what is already here, without changing anything. */
export function previewImport(store, records) {
  const added = [];
  const same = [];
  const different = [];
  records.forEach((incoming) => {
    const mine = store.get(incoming.key);
    if (!mine) added.push(incoming);
    else if (sameContent(mine, incoming)) same.push(incoming);
    else different.push({ mine, incoming });
  });
  const incomingKeys = new Set(records.map((r) => r.key));
  const onlyHere = store.all().filter((r) => !incomingKeys.has(r.key));
  return { added, same, different, onlyHere };
}
