#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_SECTIONS = [
  'Objective trace',
  'Architecture decision',
  'Architecture blocks',
  'Cross-block contracts',
  'Verification and recovery intent',
  'Deferred to block refinement',
  'Backlog handoff'
];
const BLOCK_FIELDS = ['Outcome', 'Boundary', 'Depends on', 'Acceptance intent'];
const BLOCK_ID = /^BLK-[A-Z0-9][A-Z0-9-]{1,30}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;
const JIRA_KEY = /^[A-Z][A-Z0-9_]*-[1-9][0-9]*$/u;

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function error(code, detail) { return { code, detail }; }
function nonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function stringArray(value) { return Array.isArray(value) && value.length > 0 && value.every(nonEmptyString); }
function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function parseMetadata(lines, firstHeading) {
  const metadata = new Map();
  for (const line of lines.slice(1, firstHeading)) {
    if (!line.trim()) continue;
    const match = /^([A-Za-z][A-Za-z-]*):\s*(.+)$/u.exec(line);
    if (!match) return { metadata, malformed: line };
    if (metadata.has(match[1])) return { metadata, duplicate: match[1] };
    metadata.set(match[1], match[2].trim());
  }
  return { metadata };
}

function sectionRanges(lines) {
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^## ([^#].*)$/u.exec(lines[index]);
    if (match) starts.push({ name: match[1].trim(), start: index + 1 });
  }
  return starts.map((item, index) => ({ ...item, end: starts[index + 1] ? starts[index + 1].start - 1 : lines.length }));
}

function parseBlocks(lines, range, errors) {
  const blocks = [];
  const headings = [];
  for (let index = range.start; index < range.end; index += 1) {
    const match = /^### ([A-Z0-9-]+):\s*(.+)$/u.exec(lines[index]);
    if (match) headings.push({ id: match[1], title: match[2].trim(), start: index + 1 });
  }
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const end = headings[index + 1] ? headings[index + 1].start - 1 : range.end;
    const fields = new Map();
    for (const line of lines.slice(heading.start, end)) {
      const match = /^([A-Za-z][A-Za-z ]+):\s*(.*)$/u.exec(line);
      if (match && BLOCK_FIELDS.includes(match[1])) fields.set(match[1], match[2].trim());
    }
    if (!BLOCK_ID.test(heading.id)) errors.push(error('DESIGN_BLOCK_ID_INVALID', `${heading.id} is not a valid delivery-block ID.`));
    if (!heading.title) errors.push(error('DESIGN_BLOCK_TITLE_MISSING', `${heading.id} has no title.`));
    for (const field of BLOCK_FIELDS) {
      if (!nonEmptyString(fields.get(field))) errors.push(error('DESIGN_BLOCK_FIELD_MISSING', `${heading.id} is missing ${field}.`));
    }
    const dependencyText = fields.get('Depends on') ?? '';
    const dependsOn = dependencyText.toLowerCase() === 'none' ? []
      : dependencyText.split(',').map((value) => value.trim()).filter(Boolean);
    blocks.push({ id: heading.id, title: heading.title, dependsOn });
  }
  if (!blocks.length) errors.push(error('DESIGN_BLOCKS_MISSING', 'Architecture blocks must contain at least one delivery block.'));
  return blocks;
}

function validateBlockGraph(blocks, errors) {
  const ids = new Set();
  for (const block of blocks) {
    if (ids.has(block.id)) errors.push(error('DESIGN_BLOCK_DUPLICATE', `${block.id} appears more than once.`));
    ids.add(block.id);
  }
  for (const block of blocks) for (const dependency of block.dependsOn) {
    if (!ids.has(dependency)) errors.push(error('DESIGN_DEPENDENCY_UNKNOWN', `${block.id} depends on unknown block ${dependency}.`));
    if (dependency === block.id) errors.push(error('DESIGN_DEPENDENCY_CYCLE', `${block.id} depends on itself.`));
  }
  const visiting = new Set();
  const visited = new Set();
  const byId = new Map(blocks.map((block) => [block.id, block]));
  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id) || !byId.has(id)) return false;
    visiting.add(id);
    const cycle = byId.get(id).dependsOn.some(visit);
    visiting.delete(id);
    visited.add(id);
    return cycle;
  }
  if (blocks.some((block) => visit(block.id))) errors.push(error('DESIGN_DEPENDENCY_CYCLE', 'Delivery-block dependencies contain a cycle.'));
}

export function validateTenThousandFootDesign(bytes) {
  const text = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes);
  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  const errors = [];
  if (lines[0] !== 'KSTACK-DESIGN-10K-V1') errors.push(error('DESIGN_MARKER_INVALID', 'The first line must be KSTACK-DESIGN-10K-V1.'));
  const firstHeading = lines.findIndex((line) => line.startsWith('## '));
  if (firstHeading < 0) errors.push(error('DESIGN_SECTIONS_MISSING', 'The design has no level-two sections.'));
  const parsedMetadata = parseMetadata(lines, firstHeading < 0 ? lines.length : firstHeading);
  if (parsedMetadata.malformed) errors.push(error('DESIGN_METADATA_INVALID', `Malformed metadata line: ${parsedMetadata.malformed}`));
  if (parsedMetadata.duplicate) errors.push(error('DESIGN_METADATA_DUPLICATE', `${parsedMetadata.duplicate} appears more than once.`));
  const expectedMetadata = ['Altitude', 'Implementation-ready', 'Objective-brief', 'Objective-digest'];
  if (JSON.stringify([...parsedMetadata.metadata.keys()].sort()) !== JSON.stringify(expectedMetadata.sort())) {
    errors.push(error('DESIGN_METADATA_FIELDS_INVALID', `Metadata must contain exactly ${expectedMetadata.join(', ')}.`));
  }
  if (parsedMetadata.metadata.get('Altitude') !== '10000') errors.push(error('DESIGN_ALTITUDE_INVALID', 'Altitude must be 10000.'));
  if (parsedMetadata.metadata.get('Implementation-ready') !== 'no') errors.push(error('DESIGN_PREMATURE_IMPLEMENTATION', 'Implementation-ready must be no.'));
  if (!nonEmptyString(parsedMetadata.metadata.get('Objective-brief'))) errors.push(error('DESIGN_OBJECTIVE_MISSING', 'Objective-brief is required.'));
  if (!DIGEST.test(parsedMetadata.metadata.get('Objective-digest') ?? '')) errors.push(error('DESIGN_OBJECTIVE_DIGEST_INVALID', 'Objective-digest must be a lowercase SHA-256.'));
  if (/^```/mu.test(text)) errors.push(error('DESIGN_PREMATURE_CODE_DETAIL', 'The 10,000-foot design must not contain fenced code or command recipes.'));
  const prohibitedHeadings = /^(?:##|###) (?:Implementation steps|Deployment steps|File changes|Commands|Migration SQL|Provider payloads?)\s*$/imu;
  if (prohibitedHeadings.test(text)) errors.push(error('DESIGN_PREMATURE_DETAIL_SECTION', 'Implementation/deployment detail belongs in block refinement, not the design.'));

  const ranges = sectionRanges(lines);
  const byName = new Map();
  for (const range of ranges) {
    if (byName.has(range.name)) errors.push(error('DESIGN_SECTION_DUPLICATE', `${range.name} appears more than once.`));
    byName.set(range.name, range);
  }
  for (const name of REQUIRED_SECTIONS) {
    const range = byName.get(name);
    if (!range) errors.push(error('DESIGN_SECTION_MISSING', `${name} is required.`));
    else if (!lines.slice(range.start, range.end).some((line) => line.trim() && !line.startsWith('### '))) {
      errors.push(error('DESIGN_SECTION_EMPTY', `${name} must contain substantive content.`));
    }
  }
  const blocks = byName.has('Architecture blocks') ? parseBlocks(lines, byName.get('Architecture blocks'), errors) : [];
  validateBlockGraph(blocks, errors);
  return { schemaVersion: 1, contract: 'kstack-design-10k-v1', status: errors.length ? 'invalid' : 'valid', errors, blocks };
}

export function objectiveDigestOf(bytes) {
  const lines = (Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes)).replace(/\r\n?/gu, '\n').split('\n');
  const end = lines.findIndex((line) => line.startsWith('## '));
  for (const line of lines.slice(1, end < 0 ? lines.length : end)) {
    const match = /^Objective-digest:\s*([0-9a-f]{64})\s*$/u.exec(line);
    if (match) return match[1];
  }
  return null;
}

export function validateDeliveryBacklog({ designBytes, backlog, jiraRequired = false }) {
  const design = validateTenThousandFootDesign(designBytes);
  const errors = [...design.errors.map((item) => error('BACKLOG_DESIGN_INVALID', `${item.code}: ${item.detail}`))];
  const topKeys = ['schemaVersion', 'designDigest', 'status', 'blocks'];
  if (!exactKeys(backlog, topKeys)) errors.push(error('BACKLOG_SCHEMA_INVALID', `Backlog must contain exactly ${topKeys.join(', ')}.`));
  if (backlog?.schemaVersion !== 1) errors.push(error('BACKLOG_VERSION_INVALID', 'schemaVersion must be 1.'));
  if (backlog?.designDigest !== sha256(designBytes)) errors.push(error('BACKLOG_DESIGN_DIGEST_MISMATCH', 'Backlog is not bound to the approved design bytes.'));
  if (!['ready', 'in-progress', 'complete'].includes(backlog?.status)) errors.push(error('BACKLOG_STATUS_INVALID', 'Backlog status is invalid.'));
  if (!Array.isArray(backlog?.blocks)) errors.push(error('BACKLOG_BLOCKS_INVALID', 'blocks must be an array.'));
  const rows = Array.isArray(backlog?.blocks) ? backlog.blocks : [];
  const expectedIds = new Set(design.blocks.map((block) => block.id));
  const seenIds = new Set();
  const seenItems = new Set();
  const stateById = new Map();
  let active = 0;
  const blockKeys = ['designBlockId', 'itemId', 'jiraKey', 'summary', 'dependsOn', 'acceptanceCriteria', 'validationEvidence', 'state'];
  const designById = new Map(design.blocks.map((block) => [block.id, block]));
  for (const row of rows) {
    if (!exactKeys(row, blockKeys)) errors.push(error('BACKLOG_BLOCK_SCHEMA_INVALID', `Each backlog block must contain exactly ${blockKeys.join(', ')}.`));
    if (!expectedIds.has(row?.designBlockId)) errors.push(error('BACKLOG_BLOCK_UNKNOWN', `${row?.designBlockId ?? '<missing>'} is not in the approved design.`));
    if (seenIds.has(row?.designBlockId)) errors.push(error('BACKLOG_BLOCK_DUPLICATE', `${row.designBlockId} appears more than once.`));
    seenIds.add(row?.designBlockId);
    if (!nonEmptyString(row?.itemId) || seenItems.has(row?.itemId)) errors.push(error('BACKLOG_ITEM_ID_INVALID', `${row?.designBlockId ?? '<missing>'} has a missing or duplicate itemId.`));
    seenItems.add(row?.itemId);
    if (jiraRequired && !JIRA_KEY.test(row?.jiraKey ?? '')) errors.push(error('BACKLOG_JIRA_MAPPING_MISSING', `${row?.designBlockId ?? '<missing>'} lacks a confirmed Jira key.`));
    if (!jiraRequired && row?.jiraKey !== null && !JIRA_KEY.test(row?.jiraKey ?? '')) errors.push(error('BACKLOG_JIRA_KEY_INVALID', `${row?.designBlockId ?? '<missing>'} has an invalid Jira key.`));
    if (!nonEmptyString(row?.summary)) errors.push(error('BACKLOG_SUMMARY_MISSING', `${row?.designBlockId ?? '<missing>'} has no summary.`));
    if (!Array.isArray(row?.dependsOn) || row.dependsOn.some((value) => !nonEmptyString(value))) errors.push(error('BACKLOG_DEPENDENCIES_INVALID', `${row?.designBlockId ?? '<missing>'} has invalid dependencies.`));
    const expectedDependencies = designById.get(row?.designBlockId)?.dependsOn ?? [];
    if (JSON.stringify(row?.dependsOn ?? null) !== JSON.stringify(expectedDependencies)) errors.push(error('BACKLOG_DEPENDENCIES_MISMATCH', `${row?.designBlockId ?? '<missing>'} dependencies differ from the design.`));
    if (!stringArray(row?.acceptanceCriteria)) errors.push(error('BACKLOG_ACCEPTANCE_MISSING', `${row?.designBlockId ?? '<missing>'} needs observable acceptance criteria.`));
    if (!stringArray(row?.validationEvidence)) errors.push(error('BACKLOG_VALIDATION_MISSING', `${row?.designBlockId ?? '<missing>'} needs required validation evidence.`));
    if (!['ready', 'active', 'blocked', 'done'].includes(row?.state)) errors.push(error('BACKLOG_BLOCK_STATE_INVALID', `${row?.designBlockId ?? '<missing>'} has an invalid state.`));
    if (row?.state === 'active') active += 1;
    stateById.set(row?.designBlockId, row?.state);
  }
  for (const id of expectedIds) if (!seenIds.has(id)) errors.push(error('BACKLOG_BLOCK_MISSING', `${id} is absent from the backlog.`));
  if (active > 1) errors.push(error('BACKLOG_MULTIPLE_ACTIVE', 'At most one delivery block may be active.'));
  if (backlog?.status === 'ready' && active !== 0) errors.push(error('BACKLOG_READY_HAS_ACTIVE_BLOCK', 'A ready backlog cannot already contain an active block.'));
  if (backlog?.status === 'ready' && rows.some((row) => row.state !== 'ready')) errors.push(error('BACKLOG_READY_STATE_INVALID', 'Every block in a ready backlog must be ready.'));
  if (backlog?.status === 'in-progress' && active !== 1) errors.push(error('BACKLOG_ACTIVE_BLOCK_REQUIRED', 'An in-progress backlog must contain exactly one active block.'));
  if (backlog?.status === 'complete' && rows.some((row) => row.state !== 'done')) errors.push(error('BACKLOG_COMPLETE_STATE_INVALID', 'Every block in a complete backlog must be done.'));
  for (const row of rows.filter((item) => item.state === 'active')) {
    const unmet = row.dependsOn.filter((dependency) => stateById.get(dependency) !== 'done');
    if (unmet.length) errors.push(error('BACKLOG_ACTIVE_DEPENDENCY_UNMET', `${row.designBlockId} has unfinished dependencies: ${unmet.join(', ')}.`));
  }
  return { schemaVersion: 1, contract: 'kstack-delivery-backlog-v1', status: errors.length ? 'invalid' : 'valid', errors,
    designDigest: sha256(designBytes), blockCount: rows.length, activeBlockCount: active };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let index = 0; index < rest.length; index += 1) {
    if (!rest[index].startsWith('--')) throw new Error(`Unexpected argument: ${rest[index]}`);
    const key = rest[index].slice(2);
    if (key === 'jira-required') args[key] = true;
    else args[key] = rest[++index];
  }
  return args;
}

function writeResult(result, outFile) {
  const bytes = `${JSON.stringify(result, null, 2)}\n`;
  if (outFile) fs.writeFileSync(path.resolve(outFile), bytes, { mode: 0o600 });
  process.stdout.write(bytes);
  if (result.status !== 'valid') process.exitCode = 2;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.command === 'design') {
    if (!args.file) throw new Error('design requires --file');
    return writeResult(validateTenThousandFootDesign(fs.readFileSync(path.resolve(args.file))), args.out);
  }
  if (args.command === 'backlog') {
    if (!args.file || !args.design) throw new Error('backlog requires --file and --design');
    const designBytes = fs.readFileSync(path.resolve(args.design));
    const backlog = JSON.parse(fs.readFileSync(path.resolve(args.file), 'utf8'));
    return writeResult(validateDeliveryBacklog({ designBytes, backlog, jiraRequired: args['jira-required'] === true }), args.out);
  }
  throw new Error('Usage: kstack-workflow-contract.mjs design --file FILE [--out FILE] | backlog --design FILE --file FILE [--jira-required] [--out FILE]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (cause) { console.error(cause.stack || cause.message); process.exitCode = 2; }
}
