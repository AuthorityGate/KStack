import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { findOutboundSecret } from './kstack-safety-matchers.mjs';

const KiB = 1024;
const MiB = 1024 * KiB;

export const PANEL_SCHEMA_VERSION = 'kstack-panel-effective-spec-v1';
export const ROLE_ENVELOPE_SCHEMA_VERSION = 'kstack-panel-role-envelope-v1';

export const PANEL_PROFILES = Object.freeze({
  shipped: Object.freeze({
    name: 'shipped', voters: Object.freeze([2, 4]), advisers: Object.freeze([0, 2]),
    barriers: 4, ownerPauses: 4, fableInterventions: 2, attempts: 52,
    captureBytes: 64 * KiB, envelopeBytes: 40 * KiB, attemptDirectoryBytes: 64 * KiB,
    providerDerivedBytes: 16 * MiB, runLevelBytes: 8 * MiB,
    textBytes: 4 * KiB, findingCount: 4, findingTitleBytes: 256,
    findingBodyBytes: 2 * KiB, findingEvidenceBytes: 512,
    riskCount: 4, riskBytes: 512, questionCount: 4, questionBytes: 512,
    dispositionCount: 32, bindingCount: 8,
    issuePerBallot: 2, issuePerRound: 8, openIssues: 8, lineageIssues: 32,
    runLevelSubcaps: Object.freeze({
      manifestBindings: 0.5 * MiB, eventState: 2 * MiB, barrierTerminal: 1.5 * MiB,
      exportIndexes: 1 * MiB, securityTelemetry: 0.5 * MiB, reserve: 2.5 * MiB
    })
  }),
  hard: Object.freeze({
    name: 'hard', voters: Object.freeze([2, 16]), advisers: Object.freeze([0, 8]),
    barriers: 12, ownerPauses: 12, fableInterventions: 3, attempts: 582,
    captureBytes: 96 * KiB, envelopeBytes: 112 * KiB, attemptDirectoryBytes: 144 * KiB,
    providerDerivedBytes: 128 * MiB, runLevelBytes: 24 * MiB,
    textBytes: 8 * KiB, findingCount: 8, findingTitleBytes: 512,
    findingBodyBytes: 4 * KiB, findingEvidenceBytes: 1 * KiB,
    riskCount: 8, riskBytes: 1 * KiB, questionCount: 8, questionBytes: 1 * KiB,
    dispositionCount: 128, bindingCount: 16,
    issuePerBallot: 2, issuePerRound: 32, openIssues: 128, lineageIssues: 384,
    runLevelSubcaps: Object.freeze({
      manifestBindings: 1 * MiB, eventState: 8 * MiB, barrierTerminal: 4 * MiB,
      exportIndexes: 4 * MiB, securityTelemetry: 2 * MiB, reserve: 5 * MiB
    })
  })
});

const digestPattern = /^[a-f0-9]{64}$/;
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const roleEnvelopeKeys = new Set([
  'schemaVersion', 'attemptId', 'role', 'slotId', 'personaId', 'round',
  'backendId', 'providerFamily', 'commonPacketDigest', 'addendumDigest',
  'candidateDigest', 'specDigest', 'personaDigest', 'evidenceDigests',
  'confidence', 'unableToAssess', 'status', 'summary', 'rationale', 'findings',
  'risks', 'openQuestions', 'priorIssueDispositions', 'bindingDigests'
]);
const findingKeys = new Set(['issueId', 'title', 'body', 'evidenceRefs', 'reopensIssueId']);
const dispositionKeys = new Set(['issueId', 'disposition']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function profileFor(name) {
  const profile = PANEL_PROFILES[name];
  if (!profile) fail('PANEL_PROFILE_INVALID');
  return profile;
}

function normalizedString(value) {
  if (typeof value !== 'string' || !value.isWellFormed()) fail('CANONICAL_STRING_INVALID');
  return value.normalize('NFC');
}

function canonicalValue(value) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return normalizedString(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) fail('CANONICAL_NUMBER_INVALID');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) fail('CANONICAL_OBJECT_INVALID');
  const output = {};
  const normalizedKeys = new Map();
  for (const key of Object.keys(value)) {
    const normalizedKey = normalizedString(key);
    if (normalizedKeys.has(normalizedKey)) fail('CANONICAL_KEY_COLLISION');
    normalizedKeys.set(normalizedKey, key);
  }
  for (const key of [...normalizedKeys.keys()].sort()) output[key] = canonicalValue(value[normalizedKeys.get(key)]);
  return output;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function canonicalBytes(value) {
  return Buffer.from(canonicalJson(value), 'utf8');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function encodedStringPayloadBytes(value) {
  const normalized = normalizedString(value);
  return Buffer.byteLength(JSON.stringify(normalized), 'utf8') - 2;
}

function exactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value);
  if (actual.length !== keys.size || actual.some((key) => !keys.has(key))) fail(code);
}

function assertId(value, code = 'PANEL_ID_INVALID') {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'ascii') > 63 || !idPattern.test(value)) fail(code);
}

function assertDigest(value, code = 'PANEL_DIGEST_INVALID') {
  if (typeof value !== 'string' || !digestPattern.test(value)) fail(code);
}

function assertBoundedString(value, maximum, code) {
  if (encodedStringPayloadBytes(value) > maximum) fail(code);
}

function validateFinding(finding, profile) {
  exactKeys(finding, findingKeys, 'ROLE_ENVELOPE_FINDING_SHAPE_INVALID');
  assertId(finding.issueId, 'ROLE_ENVELOPE_ISSUE_ID_INVALID');
  assertBoundedString(finding.title, profile.findingTitleBytes, 'ROLE_ENVELOPE_FINDING_TITLE_OVERSIZED');
  assertBoundedString(finding.body, profile.findingBodyBytes, 'ROLE_ENVELOPE_FINDING_BODY_OVERSIZED');
  if (!Array.isArray(finding.evidenceRefs) || !finding.evidenceRefs.every((item) => typeof item === 'string')) fail('ROLE_ENVELOPE_EVIDENCE_REFS_INVALID');
  const evidenceBytes = finding.evidenceRefs.reduce((total, item) => total + encodedStringPayloadBytes(item), 0);
  if (evidenceBytes > profile.findingEvidenceBytes) fail('ROLE_ENVELOPE_FINDING_EVIDENCE_OVERSIZED');
  if (finding.reopensIssueId !== null) {
    assertId(finding.reopensIssueId, 'ROLE_ENVELOPE_REOPEN_ID_INVALID');
    if (finding.reopensIssueId === finding.issueId) fail('ROLE_ENVELOPE_SAME_ID_REOPEN_FORBIDDEN');
  }
}

export function validateRoleEnvelope(envelope, options = {}) {
  const profile = profileFor(options.profile ?? 'shipped');
  exactKeys(envelope, roleEnvelopeKeys, 'ROLE_ENVELOPE_SHAPE_INVALID');
  if (envelope.schemaVersion !== ROLE_ENVELOPE_SCHEMA_VERSION) fail('ROLE_ENVELOPE_VERSION_INVALID');
  if (!uuidPattern.test(envelope.attemptId)) fail('ROLE_ENVELOPE_ATTEMPT_ID_INVALID');
  if (!['required-voter', 'adviser', 'fable-mediator'].includes(envelope.role)) fail('ROLE_ENVELOPE_ROLE_INVALID');
  assertId(envelope.slotId, 'ROLE_ENVELOPE_SLOT_ID_INVALID');
  assertId(envelope.personaId, 'ROLE_ENVELOPE_PERSONA_ID_INVALID');
  assertId(envelope.backendId, 'ROLE_ENVELOPE_BACKEND_ID_INVALID');
  assertId(envelope.providerFamily, 'ROLE_ENVELOPE_PROVIDER_FAMILY_INVALID');
  if (envelope.role === 'fable-mediator') {
    if (envelope.slotId !== 'fable-mediator' || envelope.personaId !== 'fable-mediator'
      || envelope.backendId !== 'fable' || envelope.providerFamily !== 'configured-fable') fail('ROLE_ENVELOPE_FABLE_IDENTITY_INVALID');
  } else if (envelope.slotId === 'fable-mediator' || envelope.personaId === 'fable-mediator'
    || envelope.backendId === 'fable' || envelope.providerFamily === 'configured-fable') fail('ROLE_ENVELOPE_FABLE_IDENTITY_FORBIDDEN');
  if (!Number.isInteger(envelope.round) || envelope.round < 1 || envelope.round > profile.barriers) fail('ROLE_ENVELOPE_ROUND_INVALID');
  for (const key of ['commonPacketDigest', 'candidateDigest', 'specDigest', 'personaDigest']) assertDigest(envelope[key], `ROLE_ENVELOPE_${key.toUpperCase()}_INVALID`);
  if (envelope.addendumDigest !== null) assertDigest(envelope.addendumDigest, 'ROLE_ENVELOPE_ADDENDUM_DIGEST_INVALID');
  if (!Array.isArray(envelope.evidenceDigests) || envelope.evidenceDigests.length > profile.bindingCount) fail('ROLE_ENVELOPE_EVIDENCE_DIGESTS_INVALID');
  envelope.evidenceDigests.forEach((value) => assertDigest(value, 'ROLE_ENVELOPE_EVIDENCE_DIGEST_INVALID'));
  if (envelope.role === 'required-voter') {
    if (!Number.isInteger(envelope.confidence) || envelope.confidence < 0 || envelope.confidence > 100) fail('ROLE_ENVELOPE_CONFIDENCE_INVALID');
    if (envelope.unableToAssess && envelope.confidence !== 0) fail('ROLE_ENVELOPE_UNABLE_CONFIDENCE_INVALID');
    if (envelope.status !== 'ballot') fail('ROLE_ENVELOPE_STATUS_INVALID');
  } else {
    if (envelope.confidence !== null || envelope.unableToAssess !== false) fail('ROLE_ENVELOPE_NON_VOTER_CONFIDENCE_FORBIDDEN');
    const expectedStatus = envelope.role === 'adviser' ? 'advisory-report' : 'mediation-directive';
    if (envelope.status !== expectedStatus) fail('ROLE_ENVELOPE_STATUS_INVALID');
  }
  if (typeof envelope.unableToAssess !== 'boolean') fail('ROLE_ENVELOPE_UNABLE_INVALID');
  const textBytes = encodedStringPayloadBytes(envelope.summary) + encodedStringPayloadBytes(envelope.rationale);
  if (textBytes > profile.textBytes) fail('ROLE_ENVELOPE_SUMMARY_RATIONALE_OVERSIZED');
  if (!Array.isArray(envelope.findings) || envelope.findings.length > profile.findingCount) fail('ROLE_ENVELOPE_FINDINGS_INVALID');
  envelope.findings.forEach((finding) => validateFinding(finding, profile));
  if (new Set(envelope.findings.map((finding) => finding.issueId)).size !== envelope.findings.length) fail('ROLE_ENVELOPE_DUPLICATE_ISSUE_ID');
  for (const [key, count, bytes] of [
    ['risks', profile.riskCount, profile.riskBytes],
    ['openQuestions', profile.questionCount, profile.questionBytes]
  ]) {
    if (!Array.isArray(envelope[key]) || envelope[key].length > count || !envelope[key].every((item) => typeof item === 'string')) fail(`ROLE_ENVELOPE_${key.toUpperCase()}_INVALID`);
    envelope[key].forEach((item) => assertBoundedString(item, bytes, `ROLE_ENVELOPE_${key.toUpperCase()}_OVERSIZED`));
  }
  if (!Array.isArray(envelope.priorIssueDispositions) || envelope.priorIssueDispositions.length > profile.dispositionCount) fail('ROLE_ENVELOPE_DISPOSITIONS_INVALID');
  for (const disposition of envelope.priorIssueDispositions) {
    exactKeys(disposition, dispositionKeys, 'ROLE_ENVELOPE_DISPOSITION_SHAPE_INVALID');
    assertId(disposition.issueId, 'ROLE_ENVELOPE_DISPOSITION_ID_INVALID');
    if (!['resolved', 'still-open'].includes(disposition.disposition)) fail('ROLE_ENVELOPE_DISPOSITION_INVALID');
  }
  if (!Array.isArray(envelope.bindingDigests) || envelope.bindingDigests.length > profile.bindingCount || !envelope.bindingDigests.every((item) => typeof item === 'string' && encodedStringPayloadBytes(item) <= 128)) fail('ROLE_ENVELOPE_BINDINGS_INVALID');

  const expected = options.expected ?? {};
  for (const key of ['attemptId', 'role', 'slotId', 'personaId', 'round', 'backendId', 'providerFamily', 'commonPacketDigest', 'addendumDigest', 'candidateDigest', 'specDigest', 'personaDigest']) {
    if (Object.hasOwn(expected, key) && envelope[key] !== expected[key]) fail(`ROLE_ENVELOPE_BINDING_MISMATCH_${key.toUpperCase()}`);
  }
  if (options.threshold !== undefined) {
    if (!Number.isInteger(options.threshold) || options.threshold < 1 || options.threshold > 100) fail('PANEL_THRESHOLD_INVALID');
    if (envelope.role === 'required-voter' && envelope.confidence < options.threshold && envelope.findings.length === 0) fail('ROLE_ENVELOPE_DISSENT_REQUIRES_ISSUE');
  }

  const normalized = canonicalValue(envelope);
  const bytes = canonicalBytes(normalized);
  if (bytes.length > profile.envelopeBytes) fail('ROLE_ENVELOPE_OVERSIZED');
  const metadata = canonicalBytes({
    attemptId: normalized.attemptId, backendId: normalized.backendId,
    confidence: normalized.confidence, personaId: normalized.personaId,
    providerFamily: normalized.providerFamily, role: normalized.role,
    round: normalized.round, slotId: normalized.slotId, status: normalized.status,
    unableToAssess: normalized.unableToAssess
  });
  if (metadata.length > 2 * KiB) fail('ROLE_ENVELOPE_METADATA_OVERSIZED');
  return Object.freeze({ envelope: normalized, bytes, digest: sha256(bytes) });
}

function boundedRecord(value, maximum, code) {
  const bytes = Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
  if (bytes.length > maximum) fail(code);
  return bytes;
}

function scanOriginalComponents(components, profile) {
  if (!components || typeof components !== 'object' || Array.isArray(components)) fail('ATTEMPT_COMPONENTS_INVALID');
  const ordered = ['stdout', 'stderr', 'error', 'signal'];
  const buffers = ordered.map((key) => Buffer.isBuffer(components[key]) ? components[key] : Buffer.from(String(components[key] ?? ''), 'utf8'));
  const byteCount = buffers.reduce((total, buffer) => total + buffer.length, 0);
  if (byteCount > profile.captureBytes) return { disposition: 'overflow', byteCount, matcherIds: [], buffers };
  const matcherIds = [];
  try {
    for (const buffer of [...buffers, Buffer.concat(buffers)]) {
      const match = findOutboundSecret(buffer);
      if (match) matcherIds.push(match.matcherId);
    }
  } catch {
    return { disposition: 'invalid-utf8', byteCount, matcherIds: [] };
  }
  return { disposition: matcherIds.length ? 'secret-rejected' : 'clean', byteCount, matcherIds: [...new Set(matcherIds)], buffers };
}

function writeAttemptDirectory(runDirectory, attemptId, files, profile) {
  const attemptsDirectory = path.join(runDirectory, 'attempts');
  fs.mkdirSync(attemptsDirectory, { recursive: true, mode: 0o700 });
  const destination = path.join(attemptsDirectory, attemptId);
  const temporary = path.join(attemptsDirectory, `.${attemptId}.tmp`);
  if (fs.existsSync(destination) || fs.existsSync(temporary)) fail('ATTEMPT_ALREADY_EXISTS');
  const totalBytes = Object.values(files).reduce((total, bytes) => total + bytes.length, 0);
  if (totalBytes > profile.attemptDirectoryBytes) fail('ATTEMPT_DIRECTORY_OVERSIZED');
  fs.mkdirSync(temporary, { mode: 0o700 });
  try {
    for (const [name, bytes] of Object.entries(files)) fs.writeFileSync(path.join(temporary, name), bytes, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, destination);
  } catch (error) {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { recursive: true });
    throw error;
  }
  return { directory: destination, totalBytes };
}

export function persistPanelAttempt(options) {
  const profile = profileFor(options.profile ?? 'shipped');
  const attemptId = options.attemptId;
  if (!uuidPattern.test(attemptId)) fail('ATTEMPT_ID_INVALID');
  const scan = scanOriginalComponents(options.components, profile);
  const createdAt = options.createdAt ?? new Date().toISOString();
  let validated = null;
  let diagnosticCode = null;
  if (scan.disposition === 'clean') {
    try {
      const stdout = new TextDecoder('utf-8', { fatal: true }).decode(scan.buffers[0]);
      const parsed = JSON.parse(stdout);
      validated = validateRoleEnvelope(parsed, { profile: profile.name, expected: options.expected, threshold: options.threshold });
    } catch (error) {
      diagnosticCode = error?.code === 'ROLE_ENVELOPE_OVERSIZED' ? 'OUTPUT_OVERSIZED'
        : String(error?.code ?? '').startsWith('ROLE_ENVELOPE_BINDING_MISMATCH') ? 'OUTPUT_BINDING_REJECTED'
          : 'OUTPUT_MALFORMED';
    }
  } else if (scan.disposition === 'secret-rejected') diagnosticCode = 'OUTPUT_SECRET_REJECTED';
  else if (scan.disposition === 'overflow') diagnosticCode = 'OUTPUT_CAPTURE_OVERFLOW';
  else diagnosticCode = 'OUTPUT_INVALID_UTF8';

  const receipt = {
    schemaVersion: 'kstack-panel-attempt-receipt-v1', attemptId, byteCount: scan.byteCount,
    scanDisposition: scan.disposition, scanRuleIds: scan.matcherIds,
    originalSha256: ['secret-rejected', 'overflow', 'invalid-utf8'].includes(scan.disposition) ? null : sha256(Buffer.concat(scan.buffers)),
    envelopeDigest: validated?.digest ?? null,
    billingReceipt: options.billingReceipt ?? null
  };
  const manifest = {
    schemaVersion: 'kstack-panel-attempt-manifest-v1', attemptId, createdAt,
    role: options.expected?.role ?? null, slotId: options.expected?.slotId ?? null,
    status: validated ? 'complete' : 'rejected', contentArtifacts: validated ? ['envelope.json'] : []
  };
  const diagnostics = {
    schemaVersion: 'kstack-panel-attempt-diagnostic-v1', attemptId,
    code: validated ? 'ACCEPTED' : diagnosticCode, componentCount: 4,
    retryDisposition: options.retryDisposition ?? 'none'
  };
  const files = {
    'diagnostics.json': boundedRecord(diagnostics, 4 * KiB, 'ATTEMPT_DIAGNOSTICS_OVERSIZED'),
    'receipt.json': boundedRecord(receipt, 2 * KiB, 'ATTEMPT_RECEIPT_OVERSIZED'),
    'manifest.json': boundedRecord(manifest, 2 * KiB, 'ATTEMPT_MANIFEST_OVERSIZED')
  };
  if (validated) files['envelope.json'] = validated.bytes;
  const persisted = writeAttemptDirectory(path.resolve(options.runDirectory), attemptId, files, profile);
  return Object.freeze({
    status: validated ? 'complete' : 'rejected', code: diagnostics.code,
    envelope: validated?.envelope ?? null, envelopeDigest: validated?.digest ?? null,
    ...persisted
  });
}

export function storageArithmetic(profileName) {
  const profile = profileFor(profileName);
  const attemptBytes = profile.attempts * profile.attemptDirectoryBytes;
  const runLevelBytes = Object.values(profile.runLevelSubcaps).reduce((total, value) => total + value, 0);
  if (runLevelBytes !== profile.runLevelBytes) fail('RUN_LEVEL_SUBCAP_ARITHMETIC_INVALID');
  const totalBytes = attemptBytes + runLevelBytes;
  return Object.freeze({
    profile: profile.name, attempts: profile.attempts, attemptDirectoryBytes: profile.attemptDirectoryBytes,
    attemptBytes, runLevelBytes, totalBytes, ceilingBytes: profile.providerDerivedBytes,
    headroomBytes: profile.providerDerivedBytes - totalBytes
  });
}

export function assertRunStorageUsage(profileName, usage) {
  const profile = profileFor(profileName);
  if (!usage || typeof usage !== 'object') fail('RUN_STORAGE_USAGE_INVALID');
  let runLevel = 0;
  for (const [key, cap] of Object.entries(profile.runLevelSubcaps)) {
    const value = usage.runLevel?.[key];
    if (!Number.isSafeInteger(value) || value < 0 || value > cap) fail(`RUN_STORAGE_SUBCAP_EXCEEDED_${key.toUpperCase()}`);
    runLevel += value;
  }
  if (!Array.isArray(usage.attemptDirectories) || usage.attemptDirectories.length > profile.attempts) fail('RUN_ATTEMPT_CEILING_EXCEEDED');
  let attempts = 0;
  for (const bytes of usage.attemptDirectories) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > profile.attemptDirectoryBytes) fail('RUN_ATTEMPT_DIRECTORY_CAP_EXCEEDED');
    attempts += bytes;
  }
  if (attempts + runLevel > profile.providerDerivedBytes) fail('RUN_PROVIDER_DERIVED_CAP_EXCEEDED');
  return Object.freeze({ attempts, runLevel, total: attempts + runLevel });
}

export function closePanelBarrier({ spec, ballots, adviserReports = [], adviserAbsences = [] }) {
  if (!spec || spec.schemaVersion !== PANEL_SCHEMA_VERSION) fail('PANEL_SPEC_INVALID');
  if (!Array.isArray(ballots) || !Array.isArray(adviserReports) || !Array.isArray(adviserAbsences)) fail('PANEL_BARRIER_INPUT_INVALID');
  const required = spec.requiredVoters;
  if (ballots.length !== required.length) fail('PANEL_BARRIER_PARTIAL');
  const bySlot = new Map();
  for (const ballot of ballots) {
    validateRoleEnvelope(ballot, { profile: spec.capacityProfile, threshold: spec.threshold });
    if (ballot.role !== 'required-voter' || bySlot.has(ballot.slotId)) fail('PANEL_BARRIER_ROSTER_INVALID');
    bySlot.set(ballot.slotId, ballot);
  }
  const ordered = required.map((slot) => {
    const ballot = bySlot.get(slot.slotId);
    if (!ballot || ballot.personaId !== slot.personaId || ballot.backendId !== slot.backendId || ballot.providerFamily !== slot.providerFamily) fail('PANEL_BARRIER_ROSTER_INVALID');
    return ballot;
  });
  const bindingKeys = ['round', 'commonPacketDigest', 'candidateDigest', 'specDigest'];
  for (const key of bindingKeys) if (new Set(ordered.map((ballot) => ballot[key])).size !== 1) fail(`PANEL_BARRIER_${key.toUpperCase()}_MISMATCH`);
  if (ordered[0].specDigest !== spec.specDigest) fail('PANEL_BARRIER_SPEC_MISMATCH');
  const adviserSlots = new Set(spec.advisers.map((slot) => slot.slotId));
  const presentAdvisers = new Set();
  for (const report of adviserReports) {
    validateRoleEnvelope(report, { profile: spec.capacityProfile });
    if (report.role !== 'adviser' || !adviserSlots.has(report.slotId) || presentAdvisers.has(report.slotId)) fail('PANEL_BARRIER_ADVISER_INVALID');
    if (report.round !== ordered[0].round || report.commonPacketDigest !== ordered[0].commonPacketDigest || report.candidateDigest !== ordered[0].candidateDigest || report.specDigest !== spec.specDigest) fail('PANEL_BARRIER_ADVISER_BINDING_MISMATCH');
    presentAdvisers.add(report.slotId);
  }
  const absent = new Set(adviserAbsences);
  for (const slotId of absent) if (!adviserSlots.has(slotId) || presentAdvisers.has(slotId)) fail('PANEL_BARRIER_ADVISER_ABSENCE_INVALID');
  if (presentAdvisers.size + absent.size !== adviserSlots.size) fail('PANEL_BARRIER_ADVISER_RELEASE_INCOMPLETE');
  const converged = meetsPanelThreshold(ordered.map((ballot) => ballot.confidence), spec.threshold);
  return Object.freeze({
    schemaVersion: 'kstack-panel-barrier-v1', round: ordered[0].round,
    commonPacketDigest: ordered[0].commonPacketDigest, candidateDigest: ordered[0].candidateDigest,
    status: converged ? 'CONVERGED' : 'DISSENTING_BARRIER_CLOSED', threshold: spec.threshold,
    required: ordered.map((ballot) => Object.freeze({ slotId: ballot.slotId, confidence: ballot.confidence, envelopeDigest: sha256(canonicalBytes(ballot)) })),
    advisers: spec.advisers.map((slot) => Object.freeze({ slotId: slot.slotId, status: presentAdvisers.has(slot.slotId) ? 'ADVISER_REPORT_PRESENT' : 'ADVISER_REPORT_ABSENT' })),
    openIssueIds: [...new Set(ordered.filter((ballot) => ballot.confidence < spec.threshold).flatMap((ballot) => ballot.findings.map((finding) => finding.issueId)))].sort(),
    originatorResolvedCount: ordered.reduce((total, ballot) => total + ballot.priorIssueDispositions.filter((item) => item.disposition === 'resolved').length, 0)
  });
}

export function meetsPanelThreshold(confidences, threshold) {
  if (!Array.isArray(confidences) || confidences.length < 2 || !confidences.every((value) => Number.isInteger(value) && value >= 0 && value <= 100)) fail('PANEL_CONFIDENCES_INVALID');
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) fail('PANEL_THRESHOLD_INVALID');
  return confidences.every((value) => value >= threshold);
}

export function updateIssueLedger({ priorLedger = [], ballots, ownerSupersessions = [] }) {
  if (!Array.isArray(priorLedger) || !Array.isArray(ballots) || !Array.isArray(ownerSupersessions)) fail('PANEL_ISSUE_LEDGER_INPUT_INVALID');
  const ledger = new Map();
  for (const item of priorLedger) {
    if (!item || !['open', 'resolved', 'superseded'].includes(item.status) || ledger.has(item.issueId)) fail('PANEL_ISSUE_LEDGER_INVALID');
    ledger.set(item.issueId, { ...item });
  }
  for (const ballot of ballots) {
    if (ballot.role !== 'required-voter') fail('PANEL_ISSUE_NON_VOTER_FORBIDDEN');
    for (const disposition of ballot.priorIssueDispositions) {
      const issue = ledger.get(disposition.issueId);
      if (!issue || issue.status !== 'open') fail('PANEL_ISSUE_DISPOSITION_TARGET_INVALID');
      if (issue.originSlotId !== ballot.slotId) fail('PANEL_ISSUE_RESOLUTION_ORIGINATOR_REQUIRED');
      if (disposition.disposition === 'resolved') issue.status = 'resolved';
    }
    ballot.findings.forEach((finding, findingOrdinal) => {
      const existing = ledger.get(finding.issueId);
      if (existing) {
        if (existing.status !== 'open') fail('PANEL_CLOSED_ISSUE_CITATION_INVALID');
        if (finding.reopensIssueId !== null) fail('PANEL_OPEN_ISSUE_REOPEN_INVALID');
        return;
      }
      if (finding.reopensIssueId !== null) {
        const closed = ledger.get(finding.reopensIssueId);
        if (!closed || closed.status === 'open') fail('PANEL_REOPEN_TARGET_NOT_CLOSED');
      }
      ledger.set(finding.issueId, {
        issueId: finding.issueId, originSlotId: ballot.slotId,
        sourceEnvelopeDigest: sha256(canonicalBytes(ballot)), findingOrdinal,
        status: 'open', reopensIssueId: finding.reopensIssueId
      });
    });
  }
  for (const record of ownerSupersessions) {
    if (!record || Object.keys(record).sort().join(',') !== 'issueId,ownerRecordDigest,successorId') fail('PANEL_OWNER_SUPERSESSION_INVALID');
    const issue = ledger.get(record.issueId);
    const successor = ledger.get(record.successorId);
    assertDigest(record.ownerRecordDigest, 'PANEL_OWNER_RECORD_DIGEST_INVALID');
    if (!issue || issue.status !== 'open' || !successor || successor.status !== 'open' || issue.issueId === successor.issueId) fail('PANEL_OWNER_SUPERSESSION_TARGET_INVALID');
    issue.status = 'superseded';
    issue.successorId = successor.issueId;
    issue.ownerRecordDigest = record.ownerRecordDigest;
  }
  return [...ledger.values()].sort((left, right) => left.issueId.localeCompare(right.issueId)).map(Object.freeze);
}

export function evaluateMediationNeed(previousBarrier, currentBarrier, ownerRouting) {
  if (!previousBarrier || !currentBarrier || previousBarrier.status !== 'DISSENTING_BARRIER_CLOSED' || currentBarrier.status !== 'DISSENTING_BARRIER_CLOSED') return Object.freeze({ action: 'CONTINUE_AUTHORING', reason: 'NO_CLOSED_DISSENT_PAIR' });
  const routes = new Map((ownerRouting ?? []).map((route) => [route.issueId, route]));
  if (!Array.isArray(ownerRouting) || routes.size !== ownerRouting.length || routes.size !== currentBarrier.openIssueIds.length) return Object.freeze({ action: 'OWNER_DECISION_REQUIRED', reason: 'ROUTING_NOT_EXHAUSTIVE' });
  for (const issueId of currentBarrier.openIssueIds) {
    const route = routes.get(issueId);
    if (!route || Object.keys(route).sort().join(',') !== 'classification,issueId,ownerCertified' || route.ownerCertified !== true || !['factual', 'technical', 'value', 'policy', 'mixed', 'uncertain'].includes(route.classification)) return Object.freeze({ action: 'OWNER_DECISION_REQUIRED', reason: 'UNCLASSIFIED_ISSUE' });
    if (route.classification !== 'factual' && route.classification !== 'technical') return Object.freeze({ action: 'OWNER_DECISION_REQUIRED', reason: 'VALUE_OR_POLICY_CONFLICT' });
  }
  const sameIssues = canonicalJson(previousBarrier.openIssueIds) === canonicalJson(currentBarrier.openIssueIds);
  const previousScores = new Map(previousBarrier.required.map((item) => [item.slotId, item.confidence]));
  const noScoreProgress = currentBarrier.required.every((item) => item.confidence <= (previousScores.get(item.slotId) ?? -1));
  if (!sameIssues || !noScoreProgress) return Object.freeze({ action: 'CONTINUE_AUTHORING', reason: 'MEASURABLE_PROGRESS' });
  return Object.freeze({ action: 'INVOKE_FABLE', reason: 'GENUINE_STUCK_FACTUAL_DISAGREEMENT', issueIds: currentBarrier.openIssueIds });
}

export function bindFableDirective(envelope, authoringAttemptOrdinal, profile = 'shipped') {
  const validated = validateRoleEnvelope(envelope, { profile });
  if (validated.envelope.role !== 'fable-mediator') fail('FABLE_DIRECTIVE_ROLE_INVALID');
  if (!Number.isInteger(authoringAttemptOrdinal) || authoringAttemptOrdinal < 0) fail('AUTHORING_ATTEMPT_ORDINAL_INVALID');
  return Object.freeze({
    schemaVersion: 'kstack-panel-fable-binding-v1', directiveDigest: validated.digest,
    appliesOnlyToAuthoringAttempt: authoringAttemptOrdinal + 1, consumed: false
  });
}

export function consumeFableDirective(binding, authoringAttemptOrdinal) {
  if (!binding || binding.schemaVersion !== 'kstack-panel-fable-binding-v1' || binding.consumed) fail('FABLE_DIRECTIVE_UNAVAILABLE');
  if (binding.appliesOnlyToAuthoringAttempt !== authoringAttemptOrdinal) fail('FABLE_DIRECTIVE_ATTEMPT_MISMATCH');
  return Object.freeze({ ...binding, consumed: true });
}

export function settleNonVoterFailure(role) {
  if (role === 'adviser') return Object.freeze({ status: 'ADVISER_REPORT_ABSENT', terminalEligible: false, pauseAuthoring: false });
  if (role === 'fable-mediator') return Object.freeze({ status: 'FABLE_DIRECTIVE_ABSENT', terminalEligible: false, pauseAuthoring: true, operatorEscalation: true });
  fail('NON_VOTER_ROLE_INVALID');
}

export function routePanelTerminal(input, hasClosedDissentingCandidate) {
  if (typeof hasClosedDissentingCandidate !== 'boolean') fail('TERMINAL_DISSENT_PREDICATE_INVALID');
  const required = input?.role === 'required-voter';
  const runEvent = input?.role === undefined && input?.kind === 'independently-established-run-level-event';
  if (!required && !runEvent) fail('TERMINAL_INPUT_ROLE_FORBIDDEN');
  if (required && input?.kind !== undefined) fail('TERMINAL_INPUT_KIND_FORBIDDEN');
  if (required && !['provider', 'policy', 'resource'].includes(input.category)) fail('TERMINAL_REQUIRED_CATEGORY_INVALID');
  if (runEvent && !['policy', 'resource', 'owner-cancelled'].includes(input.category)) fail('TERMINAL_RUN_EVENT_CATEGORY_INVALID');
  if (hasClosedDissentingCandidate) {
    const reason = input.category === 'owner-cancelled' ? 'OWNER_CANCELLED'
      : input.category === 'provider' ? 'LATER_REQUIRED_PROVIDER_FAILURE'
        : input.reason ?? input.eventId ?? input.category.toUpperCase();
    return Object.freeze({ terminal: 'INCOMPLETE_WITH_DISSENT', reason, exportClosedCandidate: true });
  }
  if (input.category === 'owner-cancelled') return Object.freeze({ terminal: 'PANEL_ABORTED', reason: 'OWNER_CANCELLED', exportClosedCandidate: false });
  const terminal = input.category === 'provider' ? 'PANEL_BLOCKED_PROVIDER'
    : input.category === 'policy' ? 'PANEL_BLOCKED_POLICY' : 'PANEL_BLOCKED_RESOURCE';
  return Object.freeze({ terminal, reason: input.reason ?? input.eventId ?? input.category.toUpperCase(), exportClosedCandidate: false });
}

export function selectIncompleteCandidate(closedBarriers) {
  const candidates = closedBarriers.filter((barrier) => barrier.status === 'DISSENTING_BARRIER_CLOSED');
  if (!candidates.length) return null;
  return [...candidates].sort((left, right) => {
    const passing = (barrier) => barrier.required.filter((item) => item.confidence >= barrier.threshold).length;
    const minimum = (barrier) => Math.min(...barrier.required.map((item) => item.confidence));
    return passing(right) - passing(left) || minimum(right) - minimum(left)
      || (right.originatorResolvedCount ?? 0) - (left.originatorResolvedCount ?? 0)
      || right.round - left.round;
  })[0];
}
