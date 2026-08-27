const ACTOR_KIND = 'actor-reference-v1';

export function isPromptReferenceAllowed(reference) {
  return reference !== null && typeof reference === 'object' && !Array.isArray(reference)
    && reference.kind === ACTOR_KIND && reference.modelContextEligible === true
    && typeof reference.bytes === 'string';
}

export function assembleReflexionPromptMessages({ policy, task, references = [] }) {
  if (typeof policy !== 'string' || typeof task !== 'string' || !Array.isArray(references)) throw new TypeError('KSTACK_REFLEXION_PROMPT_ASSEMBLY_INVALID');
  if (references.some((reference) => !isPromptReferenceAllowed(reference))) throw new TypeError('KSTACK_REFLEXION_PROMPT_REFERENCE_REJECTED');
  return Object.freeze([
    Object.freeze({ role: 'system', kind: 'trusted-policy-v1', bytes: policy }),
    Object.freeze({ role: 'user', kind: 'trusted-task-v1', bytes: task }),
    ...references.map((reference) => Object.freeze({ role: 'user', kind: ACTOR_KIND, bytes: reference.bytes }))
  ]);
}
