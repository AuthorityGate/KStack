import crypto from 'node:crypto';

const groundingTextSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'groundKind'],
  properties: {
    text: { type: 'string', minLength: 1 },
    groundKind: { type: 'string', enum: ['assertion', 'absence', 'normative'] }
  }
};

export const reviewResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'decision', 'confidence', 'failedChecks', 'securityFindings',
    'materialDissent', 'recommendation', 'strongestObjection', 'unresolvedQuestions'
  ],
  properties: {
    decision: { type: 'string', enum: ['approve', 'revise', 'block'] },
    confidence: { type: 'integer', minimum: 0, maximum: 100 },
    failedChecks: { type: 'array', items: { type: 'string', minLength: 1 } },
    securityFindings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'severity', 'summary'],
        properties: {
          id: { type: 'string', minLength: 1 },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          summary: { type: 'string', minLength: 1 }
        }
      }
    },
    materialDissent: { type: 'array', items: { type: 'string', minLength: 1 } },
    recommendation: { type: 'string', minLength: 1 },
    strongestObjection: { type: 'string', minLength: 1 },
    unresolvedQuestions: { type: 'array', items: { type: 'string', minLength: 1 } }
  }
};

const citationTargetSchema = {
  oneOf: [
    ...['recommendation', 'strongestObjection'].map((field) => ({
      type: 'object', additionalProperties: false, required: ['field'], properties: { field: { const: field } }
    })),
    ...['failedChecks', 'materialDissent', 'unresolvedQuestions'].map((field) => ({
      type: 'object', additionalProperties: false, required: ['field', 'itemIndex'],
      properties: { field: { const: field }, itemIndex: { type: 'integer', minimum: 0, maximum: 2_147_483_647 } }
    })),
    {
      type: 'object', additionalProperties: false, required: ['field', 'securityFindingId'],
      properties: { field: { const: 'securityFindings' }, securityFindingId: { type: 'string', minLength: 1 } }
    }
  ]
};

export const groundingReviewResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [...reviewResponseSchema.required, 'citations'],
  properties: {
    decision: reviewResponseSchema.properties.decision,
    confidence: reviewResponseSchema.properties.confidence,
    failedChecks: { type: 'array', items: groundingTextSchema },
    securityFindings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'severity', 'summary', 'groundKind'],
        properties: {
          id: { type: 'string', minLength: 1 },
          severity: reviewResponseSchema.properties.securityFindings.items.properties.severity,
          summary: { type: 'string', minLength: 1 },
          groundKind: groundingTextSchema.properties.groundKind
        }
      }
    },
    materialDissent: { type: 'array', items: groundingTextSchema },
    recommendation: groundingTextSchema,
    strongestObjection: groundingTextSchema,
    unresolvedQuestions: { type: 'array', items: groundingTextSchema },
    citations: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'target', 'claim', 'quotedText'],
        properties: {
          id: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,63}$' },
          target: citationTargetSchema,
          sourceId: { type: 'string', pattern: '^[A-Z][A-Z0-9_-]{0,63}$' },
          claim: { type: 'string', minLength: 1 },
          quotedText: { type: 'string', minLength: 1 }
        }
      }
    }
  }
};

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isUsableText(value) {
  return (typeof value === 'string' && value.length > 0)
    || (value && typeof value === 'object' && !Array.isArray(value) && typeof value.text === 'string' && value.text.length > 0);
}

function isTextArray(value) {
  return Array.isArray(value) && value.every(isUsableText);
}

export function validateReview(review) {
  const errors = [];
  const requiredKeys = reviewResponseSchema.required;
  const allowedKeys = [...Object.keys(reviewResponseSchema.properties), 'citations'];
  if (!review || typeof review !== 'object' || Array.isArray(review)) return ['review must be an object'];
  const keys = Object.keys(review);
  if (!requiredKeys.every((key) => Object.hasOwn(review, key)) || keys.some((key) => !allowedKeys.includes(key))) errors.push('review fields do not match the required schema');
  if (!['approve', 'revise', 'block'].includes(review.decision)) errors.push('decision is invalid');
  if (!Number.isInteger(review.confidence) || review.confidence < 0 || review.confidence > 100) errors.push('confidence must be an integer from 0 to 100');
  for (const key of ['failedChecks', 'materialDissent', 'unresolvedQuestions']) {
    if (!isTextArray(review[key])) errors.push(`${key} must contain usable text`);
  }
  if (!Array.isArray(review.securityFindings)) {
    errors.push('securityFindings must be an array');
  } else {
    for (const [index, finding] of review.securityFindings.entries()) {
      const findingKeys = finding && typeof finding === 'object' && !Array.isArray(finding) ? Object.keys(finding).sort() : [];
      if (!['id', 'severity', 'summary'].every((key) => findingKeys.includes(key)) || findingKeys.some((key) => !['groundKind', 'id', 'severity', 'summary'].includes(key))) errors.push(`securityFindings[${index}] fields are invalid`);
      if (typeof finding?.id !== 'string' || !finding.id) errors.push(`securityFindings[${index}].id is required`);
      if (!['low', 'medium', 'high', 'critical'].includes(finding?.severity)) errors.push(`securityFindings[${index}].severity is invalid`);
      if (typeof finding?.summary !== 'string' || !finding.summary) errors.push(`securityFindings[${index}].summary is required`);
    }
  }
  if (!isUsableText(review.recommendation)) errors.push('recommendation is required');
  if (!(isUsableText(review.strongestObjection) || (review.strongestObjection && typeof review.strongestObjection === 'object' && !Array.isArray(review.strongestObjection)))) errors.push('strongestObjection is required');
  return errors;
}

export function projectReviewText(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.summary === 'string') return value.summary;
  }
  return null;
}

const PROSE_CONCERN_TERMS = Object.freeze([
  'concern', 'concerns', 'caveat', 'caveats', 'limitation', 'limitations',
  'shortcoming', 'shortcomings', 'weakness', 'weaknesses', 'deficiency', 'deficiencies',
  'insufficient', 'inadequate', 'unresolved', 'unverified', 'unaddressed', 'unclear',
  'ambiguous', 'gap', 'gaps', 'missing', 'incomplete', 'not verified',
  'cannot be verified', 'residual risk'
]);

// A structurally clean report can still describe a defect in prose only, which the
// counter-based readiness predicate cannot see. This bounded lexicon is a
// fail-closed heuristic, not a guarantee: it can fire on a negated mention.
export function proseRoutingSignal(review) {
  const applicable = review.decision === 'approve'
    && ['failedChecks', 'securityFindings', 'materialDissent', 'unresolvedQuestions']
      .every((field) => review[field].length === 0);
  const text = ['recommendation', 'strongestObjection']
    .map((field) => projectReviewText(review[field]) ?? '').join('\n');
  const matched = applicable
    ? PROSE_CONCERN_TERMS.filter((term) => new RegExp(`\\b${term}\\b`, 'iu').test(text))
    : [];
  return Object.freeze({
    method: 'structured-prose-consistency-v1',
    scannedFields: Object.freeze(['recommendation', 'strongestObjection']),
    applicable,
    matchedTerms: Object.freeze(matched),
    clean: matched.length === 0
  });
}

// A design may not leave the review loop carrying an unresolved high or critical security
// finding, even from an accepted final review. Lower severities remain bug-fix intake. The
// runner and the independent gate both read this so their acceptance rules cannot diverge.
export const BLOCKING_SECURITY_SEVERITIES = Object.freeze(['high', 'critical']);

export function blockingSecurityFindings(review) {
  return Object.freeze((review?.securityFindings ?? [])
    .filter((finding) => BLOCKING_SECURITY_SEVERITIES.includes(finding?.severity)));
}

// Only an explicit approval releases a design. A final that says "revise" is asking for change,
// so treating it as acceptance because it merely was not a hard block would let the loop exit on
// the reviewer's weakest affirmative.
export const FINAL_ACCEPTANCE_DECISIONS = Object.freeze(['approve']);

export function finalDecisionAccepted(review) {
  return FINAL_ACCEPTANCE_DECISIONS.includes(review?.decision);
}

// Failed checks, material dissent, and open questions can each describe an unresolved design or
// authority defect rather than implementation work, so an accepted final does not get to route
// them onward silently. Each needs a typed, reasoned disposition recorded against that exact
// review. Lower-severity security findings keep the existing bug-fix intake path; high and
// critical ones never reach here because they block acceptance outright.
export const FINAL_DISPOSITION_KINDS = Object.freeze(['implementation-work', 'accepted-residual', 'design-change-required']);
export const FINAL_DISPOSITION_SCHEMA = 'kstack-staged-review-final-disposition-v1';
// The record sits beside the review it discharges, so the runner and the gate resolve it from
// the review directory alone and cannot be pointed at different files.
export const FINAL_DISPOSITION_FILE = 'final-disposition.json';

// A disposition is an authority act, not a review output: it decides that a named finding may
// stand without a further design cycle. Only a human role may take it. The mechanism enforces
// that the record names such a role and is bound to the exact review it discharges; it cannot
// prove which keyboard produced the bytes, for the same same-uid reason the local evidence set
// is unsigned. See the decision record's disposition authority entry for the accepted limit.
export const FINAL_DISPOSITION_AUTHORITY_ROLES = Object.freeze(['owner']);
// A tripwire, not a proof: it catches a record that openly attributes itself to an agent.
// Bare "ai" is deliberately absent -- this project's own human owner identity contains it,
// so admitting it would reject the very human this check exists to insist on.
const AGENT_AUTHORED_IDENTITY = /\b(?:claude|codex|opus|sonnet|haiku|fable|gpt|chatgpt|copilot|gemini|llm|assistant|agent|bot)\b/iu;

export function finalDispositionAuthorityErrors(authority) {
  if (!authority || typeof authority !== 'object' || Array.isArray(authority)) return ['disposition record names no authority'];
  const errors = [];
  if (!FINAL_DISPOSITION_AUTHORITY_ROLES.includes(authority.role)) errors.push('disposition authority names no recognised human role');
  const name = typeof authority.name === 'string' ? authority.name.trim() : '';
  if (name.length === 0) errors.push('disposition authority names no person');
  else if (AGENT_AUTHORED_IDENTITY.test(name)) errors.push('disposition authority identifies itself as an agent');
  const attestedAt = typeof authority.attestedAt === 'string' ? Date.parse(authority.attestedAt) : Number.NaN;
  if (!Number.isFinite(attestedAt)) errors.push('disposition authority records no attestation time');
  return errors;
}

export function requiredFinalDispositions(review) {
  return Object.freeze(finalBugFixIntake(review)
    .filter((item) => ['failed-check', 'material-dissent', 'unresolved-question', 'review-revision'].includes(item.kind))
    .map((item) => item.id));
}

// The one place the final-acceptance rule lives. The runner reports it and the independent gate
// reproduces it from the same envelope, so neither can drift into accepting what the other blocks.
export function finalAcceptanceState(review, minimumConfidence) {
  const accepted = finalDecisionAccepted(review) && review.confidence >= minimumConfidence;
  const blocking = blockingSecurityFindings(review);
  const required = requiredFinalDispositions(review);
  const intake = finalBugFixIntake(review);
  return Object.freeze({
    accepted,
    blockingSecurityCount: blocking.length,
    required,
    intakeCount: intake.length,
    disposition: accepted
      ? blocking.length > 0 ? 'return-to-primary'
        : required.length > 0 ? 'disposition-required'
          : intake.length === 0 ? 'clean' : 'bugfix-only'
      : 'return-to-primary'
  });
}

export function evaluateFinalDisposition(review, finalEnvelopeSha256, record) {
  const required = requiredFinalDispositions(review);
  if (required.length === 0) return Object.freeze({ required, satisfied: true, errors: Object.freeze([]) });
  const errors = [];
  if (record === null || record === undefined) errors.push('no disposition record is present');
  else {
    if (record.schema !== FINAL_DISPOSITION_SCHEMA) errors.push('disposition record schema is not recognised');
    // Binding the record to the final envelope digest stops a disposition written for one
    // review from silently discharging the findings of a different one.
    if (record.finalEnvelopeSha256 !== finalEnvelopeSha256) errors.push('disposition record is not bound to this final review');
    for (const error of finalDispositionAuthorityErrors(record.authority)) errors.push(error);
    const entries = Array.isArray(record.dispositions) ? record.dispositions : null;
    if (entries === null) errors.push('disposition record carries no disposition list');
    else {
      const seen = new Map();
      for (const entry of entries) {
        if (!required.includes(entry?.id)) { errors.push(`disposition ${entry?.id ?? '(unnamed)'} does not match a finding of this review`); continue; }
        if (seen.has(entry.id)) { errors.push(`finding ${entry.id} is disposed more than once`); continue; }
        if (!FINAL_DISPOSITION_KINDS.includes(entry?.kind)) { errors.push(`finding ${entry.id} has no valid disposition kind`); continue; }
        if (typeof entry?.rationale !== 'string' || entry.rationale.trim().length === 0) { errors.push(`finding ${entry.id} has no recorded rationale`); continue; }
        seen.set(entry.id, entry.kind);
      }
      for (const id of required) if (!seen.has(id)) errors.push(`finding ${id} has no disposition`);
      for (const [id, kind] of seen) {
        if (kind === 'design-change-required') errors.push(`finding ${id} is disposed as requiring a design change, so the design returns to the primary`);
      }
    }
  }
  return Object.freeze({ required, satisfied: errors.length === 0, errors: Object.freeze(errors) });
}

export function finalBugFixIntake(review) {
  const items = [];
  review.failedChecks.forEach((value, index) => items.push(Object.freeze({
    id: `FINAL-FAILED-CHECK-${index + 1}`, kind: 'failed-check', detail: projectReviewText(value) ?? JSON.stringify(value)
  })));
  review.securityFindings.forEach((value, index) => items.push(Object.freeze({
    id: value.id || `FINAL-SECURITY-${index + 1}`, kind: 'security-finding', severity: value.severity,
    detail: value.summary
  })));
  review.materialDissent.forEach((value, index) => items.push(Object.freeze({
    id: `FINAL-MATERIAL-DISSENT-${index + 1}`, kind: 'material-dissent', detail: projectReviewText(value) ?? JSON.stringify(value)
  })));
  review.unresolvedQuestions.forEach((value, index) => items.push(Object.freeze({
    id: `FINAL-UNRESOLVED-QUESTION-${index + 1}`, kind: 'unresolved-question', detail: projectReviewText(value) ?? JSON.stringify(value)
  })));
  if (review.decision === 'revise' && items.length === 0) items.push(Object.freeze({
    id: 'FINAL-REVISE-1', kind: 'review-revision', detail: projectReviewText(review.recommendation) ?? JSON.stringify(review.recommendation)
  }));
  return Object.freeze(items);
}

function parseJsonText(value) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export function extractReview(raw) {
  let parsed = parseJsonText(raw);
  if (Array.isArray(parsed)) {
    const result = [...parsed].reverse().find((event) => event?.type === 'result' && event?.subtype === 'success');
    if (!result) throw new Error('Claude output did not contain a successful result event');
    parsed = result.structured_output ?? parseJsonText(result.result);
  } else if (parsed?.structured_output) {
    parsed = parsed.structured_output;
  } else if (typeof parsed?.result === 'string') {
    parsed = parseJsonText(parsed.result);
  }
  const errors = validateReview(parsed);
  if (errors.length) throw new Error(errors.join('; '));
  return parsed;
}
