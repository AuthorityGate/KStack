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
