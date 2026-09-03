#!/usr/bin/env node
/**
 * KStack memory maturity slice 1: identity, authority, citation, and capability
 * contracts.
 *
 * Accepted design:
 *   .kstack/decisions/memory-maturity-2026-08-26-slice1-authority-citation.md
 *   sha256 6a444beb3302428fc0fd824c3df88eeae653f65e35b6b7177845812f1d85f8d4
 *
 * Slice 1 ships only schemas, canonicalization/capability contracts, fixtures,
 * and a broker seam behind a disabled flag. This file holds the pure contracts:
 * the KSB1/KSF1 deterministic byte encoding, repository identity derivation,
 * the Jira canonical observation encoding, closed-schema parsers, the freshness
 * state machine, and authorization as a pure function.
 *
 * THREAT SCOPE for caller-supplied input. Every value crossing into this module
 * is treated as hostile: it may carry accessors that return a different value
 * on each read, be a Proxy, own-override methods or well-known symbols such as
 * `map`, `constructor`, `@@species` or `@@iterator`, or be a reference the
 * caller mutates after validation. `inertCopy` is the single boundary that
 * neutralizes all of that, and no other code here touches a caller's object.
 * Explicitly OUT of scope: same-realm prototype pollution — an attacker who can
 * already overwrite `Array.prototype.map` or `Object.prototype` itself. No
 * in-module defense holds against that, and claiming otherwise would be a false
 * assurance rather than a control.
 *
 * OWN-KEY ENUMERATION INVARIANT. Any operation that materializes an own-key
 * list on a value — `Object.keys`, `getOwnPropertyNames`, `getOwnPropertySymbols`,
 * `entries`, `values`, `Object.assign`, object spread, `for...in`,
 * `Reflect.ownKeys`, `JSON.stringify`, `structuredClone` — may be applied ONLY
 * to a value already proven to be an ordinary plain object: `typeof` object,
 * not a Proxy, not a boxed primitive, not `ArrayBuffer.isView`. `assertEnumerableInput`
 * is that proof and must run before both the string-key and symbol-key halves
 * of enumeration, which are one operation in the language and may or may not be
 * short-circuited by a given engine.
 *
 * This guard is COMPLETE BY CONSTRUCTION, not by however many rounds of probing
 * happen to find things. The language defines a closed set of exotic objects
 * whose own-key enumeration costs more than the caller paid to construct them:
 * String exotic objects (one index key per character), Integer-Indexed exotic
 * objects — every typed array and therefore every Buffer — (one index key per
 * element), and Proxy (an `ownKeys` result materialized in full before its
 * length can be inspected). Module Namespace objects are exotic in the same
 * sense but present no amplification risk: their key count is fixed by the
 * module's static export list, not by anything a caller supplies, and they are
 * in any case already refused by the symbol-key check below. Ordinary arrays are deliberately
 * excluded: their dense index keys were paid for by the caller when the array
 * was built, and length is separately bounded by `LIMITS.listElements`.
 *
 * Byte views matter twice over. A view must never be enumerated, but it is a
 * legitimate COPY target — and `inertCopy`'s output for one is a `Buffer`, which
 * is itself one-key-per-byte. Charging bytes cannot close that: a bounded copy
 * can still hand downstream code an object whose enumeration is unbounded. Only
 * refusing to enumerate views closes it, which is why the guard rejects them
 * rather than the budget merely pricing them.
 *
 * ALLOCATION INVARIANT. The copier never causes allocation — its own or the
 * engine's — exceeding a fixed constant multiple of memory the caller already
 * holds, and total allocation per boundary crossing is bounded by one
 * byte-denominated budget charged before each allocation.
 *
 * This file imports only `node:crypto` and `node:util`'s `types` brand checks.
 * `util.types` carries no filesystem, process, network, or environment
 * authority — it is pure value introspection — so the authority scope this
 * header describes is unchanged even though the import list is not. It performs no
 * filesystem access, no process spawn, no network request, and no environment
 * lookup, so it cannot carry repository-write, Jira-write, release, delivery,
 * or reviewer authority.
 */
import crypto from 'node:crypto';
import { types } from 'node:util';

export const SLICE1_DESIGN_DIGEST =
  '6a444beb3302428fc0fd824c3df88eeae653f65e35b6b7177845812f1d85f8d4';

/* ------------------------------------------------------------------------- */
/* Errors and small helpers                                                   */
/* ------------------------------------------------------------------------- */

export class MemoryAuthorityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MemoryAuthorityError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new MemoryAuthorityError(code, message);
}

export function exactKeys(value, allowed, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('KSTACK_MEMORY_SCHEMA_INVALID', `${label} must be a plain object`);
  }
  // Independently of `inertCopy`: this function enumerates keys too, and runs
  // first in every parser, so it needs the same guard before `Object.keys`.
  assertEnumerableInput(value, label);
  const present = Object.keys(value);
  const allowedSet = allowed instanceof Set ? allowed : new Set(allowed);
  for (const key of present) {
    if (!allowedSet.has(key)) fail('KSTACK_MEMORY_SCHEMA_UNKNOWN_FIELD', `${label} has unknown field ${key}`);
  }
  for (const key of allowedSet) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail('KSTACK_MEMORY_SCHEMA_MISSING_FIELD', `${label} is missing field ${key}`);
    }
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail('KSTACK_MEMORY_SCHEMA_UNKNOWN_FIELD', `${label} has symbol-keyed fields`);
  }
  return value;
}

export const INERT_COPY_LIMITS = Object.freeze({
  depth: 6,
  // Aligned with the design's own list bound rather than an arbitrary default:
  // a field set may legally declare up to `LIMITS.listElements` fields, and a
  // tighter cap here would reject input the design permits.
  keysPerObject: 1024,
  // Derived from the widest legal combination the module must admit, rather
  // than sized against one caller: `LIMITS.listElements` field sets, each
  // carrying up to `LIMITS.listElements` fields, and each field contributing
  // its own object plus its `scalarTypes` array. The previous constant was
  // computed against grants alone and rejected 128 full-width field sets, which
  // the seam accepts. Expressed as arithmetic so the relationship stays visible
  // if either bound moves.
  // A SLOT budget, not a container count: every array element and object key
  // copied costs one unit, so total allocation is O(totalNodes) rather than
  // O(totalNodes x 1024). Counting containers alone let one counted node
  // allocate 1024 slots, which is what allowed a few-kilobyte payload — or
  // three Proxies manufacturing fresh maximum-size containers for free — to
  // exhaust the heap and kill the process.
  //
  // The constant is sized against REAL cost per slot, not a nominal one. An
  // object key in dictionary mode costs far more than a machine word once the
  // key string and property metadata are counted, so a budget of 2^24 slots
  // still permitted a multi-hundred-megabyte copy. 2^21 keeps the worst case in
  // the tens of megabytes.
  //
  // DELIBERATE TRADEOFF, recorded rather than silently chosen: this admits 128
  // field sets at the full `LIMITS.listElements` field count (~1.2M slots,
  // the case raised in review) but NOT the theoretical maximum of 1024 such
  // field sets in a single copy (~9.4M slots). Admitting that combination would
  // mean accepting a multi-hundred-megabyte allocation from one caller payload,
  // which is the very failure this bound exists to prevent. If a real caller
  // ever needs it, the fix is to stream or chunk that input, not to raise this.
  totalNodes: 2097152,
  // A BYTE budget, charged before each byte-valued allocation and accumulated
  // across one boundary crossing. Slot count was never the real resource:
  // a byte-valued leaf costs exactly one slot no matter how large it is, so
  // 1024 aliased 4MiB views could pass the slot budget while allocating
  // gigabytes.
  //
  // DELIBERATE TRADEOFF, recorded in the same style as `totalNodes`: 64MiB
  // admits roughly sixteen maximum-size canonical observations
  // (`LIMITS.canonicalObservation` is 4MiB) in a single crossing, which is
  // comfortably above any legitimate batch this slice produces, while keeping
  // the worst case a bounded allocation rather than an unbounded one. Raising
  // it trades directly against how much memory one caller payload can command.
  totalBytes: 67108864
});

/**
 * The real `%TypedArray%.prototype` and `DataView.prototype` accessors,
 * captured at module load before any caller exists.
 *
 * `ArrayBuffer.isView` proves the value carries a view's internal slot, but
 * `buffer`, `byteOffset` and `byteLength` are ordinary named properties on the
 * prototype — only integer-indexed elements are exotic — so a GENUINE view can
 * shadow them with own data properties. Reading them normally therefore asks
 * the caller where its own bytes live, which lets a real view over benign bytes
 * report a different backing buffer or offset and have those bytes copied in
 * its place. Borrowing the accessors reads the internal slots instead.
 */
const VIEW_ACCESSORS = (() => {
  const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
  const accessor = (prototype, name) => Object.getOwnPropertyDescriptor(prototype, name).get;
  return Object.freeze({
    typed: Object.freeze({
      buffer: accessor(typedArrayPrototype, 'buffer'),
      byteOffset: accessor(typedArrayPrototype, 'byteOffset'),
      byteLength: accessor(typedArrayPrototype, 'byteLength')
    }),
    view: Object.freeze({
      buffer: accessor(DataView.prototype, 'buffer'),
      byteOffset: accessor(DataView.prototype, 'byteOffset'),
      byteLength: accessor(DataView.prototype, 'byteLength')
    })
  });
})();

/**
 * The `ArrayBuffer.prototype.detached` getter where the runtime provides it,
 * captured at load time. `null` on older runtimes, where the explicit check is
 * skipped and the construction guard below is the remaining defence.
 */
const BUFFER_DETACHED = (() => {
  const descriptor = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'detached');
  return descriptor && typeof descriptor.get === 'function' ? descriptor.get : null;
})();

/**
 * Copy the bytes a view genuinely covers, reading its internal slots through
 * borrowed accessors rather than through property access the caller can shadow.
 */
function copyViewBytes(value, label, budget = null) {
  let slots = VIEW_ACCESSORS.typed;
  let byteLength;
  try {
    byteLength = slots.byteLength.call(value);
  } catch {
    // Not a typed array; the only other `ArrayBuffer.isView` shape is DataView.
    slots = VIEW_ACCESSORS.view;
    try {
      byteLength = slots.byteLength.call(value);
    } catch {
      fail('KSTACK_MEMORY_RAW_INVALID', `${label} is not a byte view`);
    }
  }
  // Bounded independently of the node/depth budgets, which measure structure
  // rather than bytes.
  if (!Number.isInteger(byteLength) || byteLength < 0 || byteLength > LIMITS.canonicalObservation) {
    fail('KSTACK_MEMORY_INPUT_TOO_LARGE', `${label} exceeds the byte bound`);
  }
  const buffer = slots.buffer.call(value);
  const byteOffset = slots.byteOffset.call(value);
  // Explicit detachment test rather than relying on what the engine happens to
  // throw when a view is constructed over a detached buffer. A detached buffer
  // reports byteLength 0 without throwing, so the bound check above passes and
  // the failure would otherwise surface only as a bare TypeError escaping this
  // module's own error types.
  // Charged after the per-view bound and before the allocation it pays for.
  if (budget !== null) charge(budget, 1, byteLength, label);
  if (BUFFER_DETACHED !== null && buffer instanceof ArrayBuffer && BUFFER_DETACHED.call(buffer) === true) {
    fail('KSTACK_MEMORY_RAW_INVALID', `${label} is backed by a detached buffer`);
  }
  try {
    return Buffer.from(new Uint8Array(buffer, byteOffset, byteLength));
  } catch {
    // Defence in depth for anything the explicit test cannot see.
    fail('KSTACK_MEMORY_RAW_INVALID', `${label} is backed by an unreadable buffer`);
    return null;
  }
}

/**
 * Deep-copy a caller-supplied value into an inert one, invoking NO
 * caller-controlled behavior.
 *
 * This is the only place in either module that touches a caller's object graph.
 * After it returns, its result shares no object with the caller, so nothing the
 * caller still holds can change what was validated.
 *
 * The hard rule is one `Get` per slot and no dispatch. Every convenient way to
 * copy a container is unsafe here, because each consults something the caller
 * can own:
 *   - `value.map(fn)` / `.slice()` / `.filter()` — an own property shadows the
 *     prototype method, so the caller chooses what runs;
 *   - `Array.prototype.map.call(value, fn)` — `ArraySpeciesCreate` reads
 *     `value.constructor` and then its `@@species`, handing the caller the
 *     constructor of the result array;
 *   - `[...value]`, `Array.from(value)`, `for...of`, `new Set(value)` — all read
 *     `value[Symbol.iterator]`, which an own property shadows;
 *   - `JSON.parse(JSON.stringify(value))` — `stringify` calls `value.toJSON`;
 *   - `structuredClone(value)` — throws on proxies and functions, deep-clones
 *     Sets and Maps that must stay live, and is unbounded.
 * So containers are rebuilt index by index and key by key, and brands are
 * tested with `ArrayBuffer.isView` rather than `instanceof`, which only walks a
 * prototype chain the caller can forge.
 *
 * Proxies and boxed primitives are REJECTED at the boundary. The earlier stance
 * here was that a Proxy needed no detection, because under one-Get-per-slot it
 * can only choose what a single read returns. That argument was about INTEGRITY
 * and it still holds — but it says nothing about the COST of reaching that read.
 * A Proxy's `ownKeys` result is fully materialized by the engine before any
 * length can be inspected, and a boxed primitive exposes one index key per
 * character, so enumerating either can allocate far more than the caller holds
 * before this code regains control. There is no lazy own-key enumeration in the
 * language, so no charge can be levied in advance; the only closure is to refuse
 * the shapes for which no O(1) pre-read of enumeration cost exists.
 *
 * THREAT SCOPE. In scope: any hostile caller-supplied object — accessors,
 * proxies, own overrides of methods or well-known symbols, and references the
 * caller keeps and mutates later. Explicitly OUT of scope: same-realm prototype
 * pollution, meaning an attacker who can already overwrite `Array.prototype.map`
 * or `Object.prototype` itself. No in-module defense holds against that, and
 * pretending otherwise would be a false assurance.
 */
/**
 * Spend budget in both dimensions, or fail.
 *
 * SLOTS count array elements and object keys, so structural allocation is
 * proportional to the budget. BYTES count byte-valued payload, which slots
 * cannot express: a 4MiB view is one slot and four million bytes. Both are
 * charged BEFORE the allocation they pay for, never after.
 */
function charge(budget, slots, bytes, label) {
  if (slots > 0) {
    budget.nodes += slots;
    if (budget.nodes > INERT_COPY_LIMITS.totalNodes) {
      fail('KSTACK_MEMORY_INPUT_TOO_COMPLEX', `${label} exceeds the copy slot budget`);
    }
  }
  if (bytes > 0) {
    budget.bytes += bytes;
    if (budget.bytes > INERT_COPY_LIMITS.totalBytes) {
      fail('KSTACK_MEMORY_INPUT_TOO_LARGE', `${label} exceeds the copy byte budget`);
    }
  }
}

/**
 * Refuse values whose key enumeration has no bounded, inspectable cost.
 *
 * Must run before ANY property read or enumeration of `value`. Both shapes make
 * the engine allocate before this module can measure anything: a Proxy's
 * `ownKeys` trap result is materialized in full before its length is knowable,
 * and a boxed primitive (`new String(...)` and friends) presents one own index
 * key per character, so `getOwnPropertyNames` on a large one costs a large
 * multiple of the string the caller already held.
 */
export function assertEnumerableInput(value, label) {
  if (types.isProxy(value)) {
    fail('KSTACK_MEMORY_INPUT_OPAQUE', `${label} is a proxy and has no bounded enumeration cost`);
  }
  if (types.isBoxedPrimitive(value)) {
    fail('KSTACK_MEMORY_INPUT_OPAQUE', `${label} is a boxed primitive and has no bounded enumeration cost`);
  }
  // Internal-slot brand test, so a forged prototype cannot defeat it. A typed
  // array — and therefore any Buffer, including one this module produced —
  // exposes one own index key per element, so enumerating an 8MiB view
  // materializes a key list many times its size.
  if (ArrayBuffer.isView(value)) {
    fail('KSTACK_MEMORY_INPUT_BYTE_VIEW', `${label} is a byte view and must never be key-enumerated`);
  }
}

/**
 * Retained size of a BigInt, in bytes.
 *
 * Measuring allocates a hex string transiently. That is bounded concretely, not
 * merely "a constant multiple": the engine refuses to construct a BigInt beyond
 * a fixed implementation cap (a `RangeError`), so the transient is at most
 * roughly twice that cap regardless of what a caller supplies.
 */
function bigIntByteLength(value) {
  const magnitude = value < 0n ? -value : value;
  return Math.ceil(magnitude.toString(16).length / 2);
}

export function inertCopy(value, label = 'value', state = null) {
  const budget = state ?? { nodes: 0, bytes: 0, depth: 0 };
  if (value === null) return null;
  const type = typeof value;
  // Variable-size PRIMITIVE leaves are charged before being retained.
  //
  // The copier returns primitives by reference rather than copying them, which
  // made them look free — but retaining one is what costs: a caller can hand
  // back a freshly manufactured multi-megabyte string from an accessor that
  // costs it nothing to declare, and the copy then holds every one of them. The
  // byte budget's own purpose ("a byte-valued leaf costs exactly one slot no
  // matter how large it is") applies exactly here; views were simply the only
  // leaf type it had ever been applied to.
  //
  // Strings are charged at two bytes per code unit, their UTF-16 retained size,
  // read in O(1) from `length`. BigInts are charged by their actual magnitude;
  // measuring that allocates a hex string proportional to a value the caller
  // already holds, which is a constant multiple and so within the invariant.
  if (type === 'string') {
    charge(budget, 0, value.length * 2, label);
    return value;
  }
  if (type === 'bigint') {
    charge(budget, 0, bigIntByteLength(value), label);
    return value;
  }
  // A Symbol VALUE is not a symbol KEY. Symbol keys are refused elsewhere; a
  // Symbol used as a leaf value was never inspected at all, and its
  // `description` is an arbitrary-length string retained by reference exactly
  // like the string leaves above. Retaining one is worse than a string: the
  // seam stores subject values in a Set that is only ever probed with `.has`,
  // so a hostile Symbol never matches, is never removed, and is unreclaimable.
  if (type === 'symbol') {
    charge(budget, 0, (value.description ?? '').length * 2, label);
    return value;
  }
  if (type === 'function') {
    // Rejected rather than charged: a closure has no O(1) measurable size the
    // way a string's `length` or a BigInt's magnitude does, and it can capture
    // arbitrarily large data that the copy then retains.
    //
    // The previous comment here claimed a function leaf was safe because it is
    // "only reachable where a schema allows it". That was wrong about this
    // module's own order of operations: `inertCopy` runs BEFORE schema
    // validation in every path (`snapshotInput`, `snapshotOpenObject`,
    // `deriveRepoId` all copy first and validate second), so a function-valued
    // field is copied and retained before any check could reject it.
    //
    // Callers with a genuinely function-valued field — the seam's
    // `transportWrite` is the one in this codebase — declare it opaque so it is
    // carried by reference and never reaches the copier at all.
    fail('KSTACK_MEMORY_INPUT_UNMEASURABLE', `${label} is a function and has no measurable retained size`);
  }
  if (type !== 'object') return value;
  // Byte views are dispatched BEFORE the enumeration guard, deliberately. The
  // guard rejects views because they must never be key-enumerated — but here a
  // view is a legitimate COPY target, and copying reads its internal slots
  // rather than enumerating it. Running `ArrayBuffer.isView` first is safe: it
  // tests a genuine internal slot and returns false for a Proxy without
  // invoking any trap, so nothing can slip past the guard by this ordering.
  if (type === 'object' && ArrayBuffer.isView(value)) {
    charge(budget, 1, 0, label);
    return copyViewBytes(value, label, budget);
  }
  // Brand rejection BEFORE any property read or key enumeration.
  assertEnumerableInput(value, label);

  charge(budget, 1, 0, label);
  if (budget.depth >= INERT_COPY_LIMITS.depth) {
    fail('KSTACK_MEMORY_INPUT_TOO_DEEP', `${label} exceeds the maximum nesting depth`);
  }

  budget.depth += 1;
  try {
    if (Array.isArray(value)) {
      const length = value.length;
      if (!Number.isInteger(length) || length < 0 || length > LIMITS.listElements) {
        fail('KSTACK_MEMORY_INPUT_TOO_LARGE', `${label} exceeds the list bound`);
      }
      // Charge the slots this container is about to allocate, not a flat one
      // per container. Charging per container made total allocation
      // O(budget x maxContainerSize) rather than O(budget): a single counted
      // node could still allocate 1024 slots, and a Proxy could manufacture a
      // fresh maximum-size container on every read at no cost to the caller.
      charge(budget, length, 0, label);
      const copy = new Array(length);
      for (let index = 0; index < length; index += 1) {
        copy[index] = inertCopy(value[index], `${label}[${index}]`, budget);
      }
      return Object.freeze(copy);
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      fail('KSTACK_MEMORY_SCHEMA_UNKNOWN_FIELD', `${label} has symbol-keyed fields`);
    }
    // Own property NAMES, not `Object.keys`: a non-enumerable own property is
    // still an own property and must not slip past the copy unseen.
    const keys = Object.getOwnPropertyNames(value);
    if (keys.length > INERT_COPY_LIMITS.keysPerObject) {
      fail('KSTACK_MEMORY_INPUT_TOO_LARGE', `${label} has too many fields`);
    }
    // Key NAMES are charged as bytes as well as slots. No exhaustion is known
    // through this path — the engine interns property names, so the copy shares
    // rather than duplicates them, and there is no cheap way to manufacture many
    // distinct large names (Proxies are refused, and accessors define values,
    // not names). It is charged anyway so the header's byte invariant is true as
    // written rather than true-except-for-one-case; the cost for any legitimate
    // schema is a few hundred bytes.
    let keyNameBytes = 0;
    for (const key of keys) keyNameBytes += key.length * 2;
    charge(budget, keys.length, keyNameBytes, label);
    const copy = Object.create(null);
    for (const key of keys) {
      copy[key] = inertCopy(value[key], `${label}.${key}`, budget);
    }
    return Object.freeze(copy);
  } finally {
    budget.depth -= 1;
  }
}

/**
 * Read every allowed field of a caller-supplied object EXACTLY ONCE and return
 * an inert, frozen, null-prototype copy of it.
 *
 * Every value reaching this module is caller-controlled and may be backed by an
 * accessor that returns a different value on each read. Validating one read and
 * then storing or acting on a later read is a time-of-check-to-time-of-use
 * defect: the check passes on a benign value while a hostile value is what
 * actually takes effect. Binding fields one at a time fixes that only where
 * someone remembered to do it, so the rule here is structural instead —
 * a parser reads the caller's object exactly once, at entry, and never touches
 * it again.
 *
 * The returned snapshot holds plain data with no accessors, so every subsequent
 * read of it is stable by construction and re-reading it freely is safe.
 *
 * Note the deliberate ordering: `exactKeys` runs FIRST, so the set of fields
 * copied is fixed by this module's allowlist rather than by whatever keys the
 * caller happened to supply.
 */
/**
 * KNOWN FOLLOW-UP, deliberately not fixed this round: nested `snapshotInput`
 * calls each begin a fresh budget even when re-copying a subtree this module
 * already made inert, so some paths pay a bounded constant-factor (roughly 2-3x)
 * re-copy. Bounded, not unbounded, so it is an efficiency matter rather than a
 * safety one. The eventual fix shape is a module-private marker letting
 * `snapshotInput` recognize and skip its own already-inert output.
 */
export function snapshotInput(value, allowed, label, opaqueKeys = null) {
  exactKeys(value, allowed, label);
  const budget = { nodes: 0, bytes: 0, depth: 0 };
  const snapshot = Object.create(null);
  for (const key of (allowed instanceof Set ? [...allowed] : allowed)) {
    const read = value[key];
    // A slot the schema declares opaque stays a live reference on purpose —
    // a shared ledger such as the consumed-nonce set must be the caller's own
    // object, not a copy of it, or consumption would be invisible.
    snapshot[key] = opaqueKeys !== null && opaqueKeys.includes(key)
      ? read
      : inertCopy(read, `${label}.${key}`, budget);
  }
  return Object.freeze(snapshot);
}

/**
 * Snapshot an open-keyed object — one whose field names are not a fixed
 * allowlist, such as a per-channel score map. Keys are enumerated once and each
 * value read once.
 */
function snapshotOpenObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('KSTACK_MEMORY_SCHEMA_INVALID', `${label} must be a plain object`);
  }
  // The caller of this function enumerates the result with `Object.entries`,
  // which is worse than `keys` for a view: two-element array per byte rather
  // than one key. Guard before the copy, so a view never becomes a Buffer that
  // is then enumerated.
  assertEnumerableInput(value, label);
  return inertCopy(value, label);
}

/**
 * Provenance markers for values this module's own parsers produced.
 *
 * These are module-private WeakSets, not a property on the value: an external
 * caller cannot forge membership. `Object.freeze` is NOT a validation marker —
 * any caller can freeze any object — so it must never be used as one.
 */
const VALIDATED_SOURCE_RECORDS = new WeakSet();
const VALIDATED_FIELD_SETS = new WeakSet();

function sha256Hex(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest();
}

export { sha256Hex };

/* ------------------------------------------------------------------------- */
/* Bounds                                                                     */
/* ------------------------------------------------------------------------- */

export const LIMITS = Object.freeze({
  text: 1024,
  host: 253,
  ownerOrRepository: 255,
  authorityPath: 4096,
  authorityPathSegment: 255,
  jiraFieldValue: 1024 * 1024,
  canonicalObservation: 4 * 1024 * 1024,
  artifactClass: 64,
  fieldId: 64,
  listElements: 1024,
  providerIdentifier: 256,
  minimumYear: 1970,
  maximumYear: 9999
});

const CONTROL_LOW_MAXIMUM = 0x1f;
const CONTROL_HIGH_MINIMUM = 0x7f;
const CONTROL_HIGH_MAXIMUM = 0x9f;

/** True when any code point is a C0 control, DEL, or a C1 control. */
function hasControlCharacter(value) {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code <= CONTROL_LOW_MAXIMUM) return true;
    if (code >= CONTROL_HIGH_MINIMUM && code <= CONTROL_HIGH_MAXIMUM) return true;
  }
  return false;
}
const LOWER_ASCII_IDENTIFIER = /^[a-z0-9][a-z0-9._:-]*$/u;
const PRINTABLE_ASCII_IDENTIFIER = /^[!-~]+$/u;
const HEX40 = /^[a-f0-9]{40}$/u;
const HEX32 = /^[a-f0-9]{32}$/u;
const HEX64 = /^[a-f0-9]{64}$/u;
const RFC3339_MILLISECONDS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/u;

/* ------------------------------------------------------------------------- */
/* Canonical scalars                                                          */
/* ------------------------------------------------------------------------- */

/**
 * Canonical human text: well formed UTF-16 input, no NUL/control characters,
 * NFKC normalized, bounded in UTF-8 bytes after normalization.
 */
export function canonicalText(value, maximumBytes, label) {
  if (typeof value !== 'string') fail('KSTACK_MEMORY_TEXT_INVALID', `${label} must be a string`);
  if (!value.isWellFormed()) fail('KSTACK_MEMORY_TEXT_INVALID', `${label} is not well formed UTF-8`);
  if (hasControlCharacter(value)) fail('KSTACK_MEMORY_TEXT_INVALID', `${label} contains control characters`);
  const normalized = value.normalize('NFKC');
  if (hasControlCharacter(normalized)) fail('KSTACK_MEMORY_TEXT_INVALID', `${label} normalizes to control characters`);
  const bytes = Buffer.from(normalized, 'utf8');
  if (bytes.length < 1) fail('KSTACK_MEMORY_TEXT_INVALID', `${label} must not be empty`);
  if (bytes.length > maximumBytes) fail('KSTACK_MEMORY_TEXT_OVERSIZE', `${label} exceeds ${maximumBytes} bytes`);
  return { text: normalized, bytes };
}

/**
 * Provider-issued identifier: bytes are retained exactly as the provider
 * issued them after a printable-ASCII and 256-byte check. Never normalized.
 */
export function providerIdentifier(value, label) {
  if (typeof value !== 'string') fail('KSTACK_MEMORY_PROVIDER_ID_INVALID', `${label} must be a string`);
  if (!PRINTABLE_ASCII_IDENTIFIER.test(value)) {
    fail('KSTACK_MEMORY_PROVIDER_ID_INVALID', `${label} must be printable ASCII without spaces`);
  }
  if (value.length > LIMITS.providerIdentifier) {
    fail('KSTACK_MEMORY_PROVIDER_ID_OVERSIZE', `${label} exceeds ${LIMITS.providerIdentifier} bytes`);
  }
  return value;
}

/**
 * Scope and path-prefix text. Bounded and control-free like canonical text,
 * but deliberately NOT NFKC normalized: these values are compared against
 * authority path bytes, which are raw and are never Unicode-normalized.
 */
export function rawScopeText(value, maximumBytes, label) {
  if (typeof value !== 'string') fail('KSTACK_MEMORY_SCOPE_INVALID', `${label} must be a string`);
  if (!value.isWellFormed()) fail('KSTACK_MEMORY_SCOPE_INVALID', `${label} is not well formed UTF-8`);
  if (hasControlCharacter(value)) fail('KSTACK_MEMORY_SCOPE_INVALID', `${label} contains control characters`);
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length < 1) fail('KSTACK_MEMORY_SCOPE_INVALID', `${label} must not be empty`);
  if (bytes.length > maximumBytes) fail('KSTACK_MEMORY_SCOPE_OVERSIZE', `${label} exceeds ${maximumBytes} bytes`);
  return value;
}

/**
 * Byte-wise scope match: exact, or a `/`-delimited prefix. Comparison is on
 * raw UTF-8 bytes so no normalization can collapse two distinct scopes.
 */
function scopeBytesMatch(scopeEntry, actualBytes, exactOnly = false) {
  const prefix = Buffer.from(scopeEntry, 'utf8');
  if (prefix.equals(actualBytes)) return true;
  if (exactOnly) return false;
  const delimited = prefix[prefix.length - 1] === 0x2f
    ? prefix
    : Buffer.concat([prefix, Buffer.from('/', 'utf8')]);
  return actualBytes.length > delimited.length
    && actualBytes.subarray(0, delimited.length).equals(delimited);
}

export function lowerAsciiIdentifier(value, maximumBytes, label) {
  if (typeof value !== 'string') fail('KSTACK_MEMORY_IDENTIFIER_INVALID', `${label} must be a string`);
  if (!LOWER_ASCII_IDENTIFIER.test(value)) {
    fail('KSTACK_MEMORY_IDENTIFIER_INVALID', `${label} must be lower-ASCII`);
  }
  if (value.length > maximumBytes) {
    fail('KSTACK_MEMORY_IDENTIFIER_OVERSIZE', `${label} exceeds ${maximumBytes} bytes`);
  }
  return value;
}

/** UTC RFC3339 with exactly three fractional digits and a literal `Z`. */
export function canonicalTimestamp(value, label) {
  if (typeof value !== 'string') fail('KSTACK_MEMORY_TIME_INVALID', `${label} must be a string`);
  const match = RFC3339_MILLISECONDS.exec(value);
  if (!match) fail('KSTACK_MEMORY_TIME_INVALID', `${label} must be UTC RFC3339 with three fractional digits`);
  const year = Number(match[1]);
  if (year < LIMITS.minimumYear || year > LIMITS.maximumYear) {
    fail('KSTACK_MEMORY_TIME_RANGE', `${label} year must be ${LIMITS.minimumYear}-${LIMITS.maximumYear}`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail('KSTACK_MEMORY_TIME_INVALID', `${label} is not a real instant`);
  if (new Date(parsed).toISOString() !== value) {
    fail('KSTACK_MEMORY_TIME_INVALID', `${label} is not a canonical instant`);
  }
  return { text: value, epochMilliseconds: parsed };
}

export function hexDigest32(value, label) {
  if (typeof value !== 'string' || !HEX64.test(value)) {
    fail('KSTACK_MEMORY_DIGEST_INVALID', `${label} must be 64 lowercase hex characters`);
  }
  return value;
}

function unsignedInteger(value, label) {
  if (typeof value === 'bigint') {
    if (value < 0n) fail('KSTACK_MEMORY_UINT_INVALID', `${label} must not be negative`);
    return value;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isSafeInteger(value) || value < 0) {
    fail('KSTACK_MEMORY_UINT_INVALID', `${label} must be a non-negative safe integer`);
  }
  return BigInt(value);
}

function rawBytes(value, label, budget = null) {
  // Brand check, not `instanceof`: this module's own rule is that a prototype
  // chain is forgeable, and `Object.create(Uint8Array.prototype)` was being
  // accepted here as bytes. `copyViewBytes` also reads the view's real slots
  // rather than caller-shadowable `buffer`/`byteOffset`/`byteLength`.
  if (ArrayBuffer.isView(value)) return copyViewBytes(value, label, budget);
  fail('KSTACK_MEMORY_RAW_INVALID', `${label} must be raw bytes`);
  return null;
}

/* ------------------------------------------------------------------------- */
/* KSB1 / KSF1 deterministic encoding                                         */
/* ------------------------------------------------------------------------- */

export const KSB1_MAGIC = 'KSB1';
export const KSF1_MAGIC = 'KSF1';

export const KSB1_TYPE = Object.freeze({
  raw: 1,
  text: 2,
  unsigned: 3,
  false: 4,
  true: 5,
  null: 6
});

const KSB1_TYPE_CODES = new Set(Object.values(KSB1_TYPE));
const KSB1_EMPTY_TYPES = new Set([KSB1_TYPE.false, KSB1_TYPE.true, KSB1_TYPE.null]);
const KSB1_HEADER_BYTES = 5;
const KSB1_FIELD_HEADER_BYTES = 7;
const MAXIMUM_CONTAINER_BYTES = LIMITS.canonicalObservation;

/** Shortest big-endian unsigned encoding; zero is exactly one `00` byte. */
export function encodeShortestUnsigned(value, label = 'unsigned') {
  const magnitude = unsignedInteger(value, label);
  if (magnitude === 0n) return Buffer.from([0x00]);
  let hex = magnitude.toString(16);
  if (hex.length % 2 === 1) hex = `0${hex}`;
  return Buffer.from(hex, 'hex');
}

export function decodeShortestUnsigned(bytes, label = 'unsigned') {
  const buffer = rawBytes(bytes, label);
  if (buffer.length === 0) fail('KSTACK_MEMORY_UINT_INVALID', `${label} must not be empty`);
  if (buffer.length > 1 && buffer[0] === 0x00) {
    fail('KSTACK_MEMORY_UINT_NON_CANONICAL', `${label} uses an alternate integer encoding`);
  }
  let magnitude = 0n;
  for (const byte of buffer) magnitude = (magnitude << 8n) | BigInt(byte);
  return magnitude;
}

function encodeFieldValue(field) {
  const label = `field ${field.id}`;
  switch (field.kind) {
    case 'raw': {
      const bytes = rawBytes(field.value, label);
      if (typeof field.maximumBytes === 'number' && bytes.length > field.maximumBytes) {
        fail('KSTACK_MEMORY_FIELD_OVERSIZE', `${label} exceeds ${field.maximumBytes} bytes`);
      }
      return { type: KSB1_TYPE.raw, bytes };
    }
    case 'text': {
      const maximum = typeof field.maximumBytes === 'number' ? field.maximumBytes : LIMITS.text;
      const { bytes } = canonicalText(field.value, maximum, label);
      return { type: KSB1_TYPE.text, bytes };
    }
    case 'pathBytes': {
      // Authority path bytes are raw and are never Unicode-normalized.
      const bytes = rawBytes(field.value, label);
      if (bytes.length > LIMITS.authorityPath) {
        fail('KSTACK_MEMORY_FIELD_OVERSIZE', `${label} exceeds ${LIMITS.authorityPath} bytes`);
      }
      return { type: KSB1_TYPE.raw, bytes };
    }
    case 'unsigned':
      return { type: KSB1_TYPE.unsigned, bytes: encodeShortestUnsigned(field.value, label) };
    case 'boolean': {
      if (typeof field.value !== 'boolean') fail('KSTACK_MEMORY_FIELD_INVALID', `${label} must be boolean`);
      return { type: field.value ? KSB1_TYPE.true : KSB1_TYPE.false, bytes: Buffer.alloc(0) };
    }
    case 'null': {
      if (field.value !== null && field.value !== undefined) {
        fail('KSTACK_MEMORY_FIELD_INVALID', `${label} must be null`);
      }
      return { type: KSB1_TYPE.null, bytes: Buffer.alloc(0) };
    }
    default:
      return fail('KSTACK_MEMORY_FIELD_INVALID', `${label} has an unsupported kind`);
  }
}

/**
 * Encode a closed KSB1/KSF1 container. Fields must be supplied in ascending
 * numeric field ID with no duplicates. Floats, maps, and unordered sets have
 * no representation here at all.
 */
export function encodeContainer({ magic = KSB1_MAGIC, schema = 1, fields }) {
  if (magic !== KSB1_MAGIC && magic !== KSF1_MAGIC) {
    fail('KSTACK_MEMORY_CONTAINER_INVALID', 'container magic is not recognized');
  }
  if (!Number.isInteger(schema) || schema < 0 || schema > 255) {
    fail('KSTACK_MEMORY_CONTAINER_INVALID', 'container schema must be one byte');
  }
  if (!Array.isArray(fields) || fields.length === 0) {
    fail('KSTACK_MEMORY_CONTAINER_INVALID', 'container requires at least one field');
  }
  // The container crosses the boundary before its bound is checked: checking
  // `fields.length` and then iterating with `for...of` bounded nothing, because
  // the caller's own `@@iterator` decides what the loop yields.
  const copiedFields = inertCopy(fields, 'container fields');
  if (copiedFields.length > LIMITS.listElements) {
    fail('KSTACK_MEMORY_CONTAINER_OVERSIZE', 'container exceeds the field list bound');
  }
  const chunks = [Buffer.from(magic, 'ascii'), Buffer.from([schema])];
  let previousId = 0;
  for (let fieldIndex = 0; fieldIndex < copiedFields.length; fieldIndex += 1) {
    const field = copiedFields[fieldIndex];
    if (!Number.isInteger(field.id) || field.id < 1 || field.id > 0xffff) {
      fail('KSTACK_MEMORY_FIELD_INVALID', 'field ID must be a uint16 above zero');
    }
    if (field.id <= previousId) {
      fail('KSTACK_MEMORY_FIELD_ORDER', 'fields must ascend by field ID without duplicates');
    }
    previousId = field.id;
    const { type, bytes } = encodeFieldValue(field);
    if (bytes.length > 0xffffffff) fail('KSTACK_MEMORY_FIELD_OVERSIZE', 'field exceeds uint32 length');
    const header = Buffer.alloc(KSB1_FIELD_HEADER_BYTES);
    header.writeUInt16BE(field.id, 0);
    header.writeUInt8(type, 2);
    header.writeUInt32BE(bytes.length, 3);
    chunks.push(header, bytes);
  }
  const encoded = Buffer.concat(chunks);
  if (encoded.length > MAXIMUM_CONTAINER_BYTES) {
    fail('KSTACK_MEMORY_CONTAINER_OVERSIZE', 'container exceeds the canonical size bound');
  }
  return encoded;
}

/** Strict decoder. Any deviation from the canonical form is a rejection. */
export function decodeContainer(bytes, { magic = KSB1_MAGIC, schema = 1 } = {}) {
  const buffer = rawBytes(bytes, 'container');
  if (buffer.length > MAXIMUM_CONTAINER_BYTES) {
    fail('KSTACK_MEMORY_CONTAINER_OVERSIZE', 'container exceeds the canonical size bound');
  }
  if (buffer.length < KSB1_HEADER_BYTES) fail('KSTACK_MEMORY_CONTAINER_INVALID', 'container is truncated');
  if (buffer.subarray(0, 4).toString('ascii') !== magic) {
    fail('KSTACK_MEMORY_CONTAINER_INVALID', 'container magic mismatch');
  }
  const declaredSchema = buffer.readUInt8(4);
  if (declaredSchema !== schema) fail('KSTACK_MEMORY_CONTAINER_INVALID', 'container schema mismatch');
  const fields = new Map();
  let offset = KSB1_HEADER_BYTES;
  let previousId = 0;
  while (offset < buffer.length) {
    if (buffer.length - offset < KSB1_FIELD_HEADER_BYTES) {
      fail('KSTACK_MEMORY_CONTAINER_INVALID', 'container field header is truncated');
    }
    const id = buffer.readUInt16BE(offset);
    const type = buffer.readUInt8(offset + 2);
    const length = buffer.readUInt32BE(offset + 3);
    offset += KSB1_FIELD_HEADER_BYTES;
    if (id < 1) fail('KSTACK_MEMORY_FIELD_INVALID', 'field ID zero is reserved');
    if (id <= previousId) fail('KSTACK_MEMORY_FIELD_ORDER', 'fields must ascend by field ID without duplicates');
    previousId = id;
    if (!KSB1_TYPE_CODES.has(type)) fail('KSTACK_MEMORY_FIELD_INVALID', `field ${id} has an unknown type code`);
    if (KSB1_EMPTY_TYPES.has(type) && length !== 0) {
      fail('KSTACK_MEMORY_FIELD_INVALID', `field ${id} must carry zero bytes`);
    }
    if (length > buffer.length - offset) {
      fail('KSTACK_MEMORY_CONTAINER_INVALID', `field ${id} declares more bytes than remain`);
    }
    fields.set(id, { id, type, bytes: buffer.subarray(offset, offset + length) });
    offset += length;
  }
  if (offset !== buffer.length) fail('KSTACK_MEMORY_CONTAINER_INVALID', 'container has trailing bytes');
  if (fields.size === 0) fail('KSTACK_MEMORY_CONTAINER_INVALID', 'container has no fields');
  return { magic, schema: declaredSchema, fields };
}

const FATAL_UTF8 = new TextDecoder('utf-8', { fatal: true });

export function readTextField(fields, id, maximumBytes, label) {
  const field = fields.get(id);
  if (!field) fail('KSTACK_MEMORY_SCHEMA_MISSING_FIELD', `${label} is missing`);
  if (field.type !== KSB1_TYPE.text) fail('KSTACK_MEMORY_FIELD_INVALID', `${label} must be text`);
  if (field.bytes.length > maximumBytes) fail('KSTACK_MEMORY_TEXT_OVERSIZE', `${label} exceeds ${maximumBytes} bytes`);
  let decoded;
  try {
    decoded = FATAL_UTF8.decode(field.bytes);
  } catch {
    return fail('KSTACK_MEMORY_TEXT_INVALID', `${label} is not valid UTF-8`);
  }
  if (decoded.normalize('NFKC') !== decoded) {
    fail('KSTACK_MEMORY_TEXT_INVALID', `${label} is not NFKC normalized`);
  }
  if (hasControlCharacter(decoded)) fail('KSTACK_MEMORY_TEXT_INVALID', `${label} contains control characters`);
  return decoded;
}

export function readUnsignedField(fields, id, label) {
  const field = fields.get(id);
  if (!field) fail('KSTACK_MEMORY_SCHEMA_MISSING_FIELD', `${label} is missing`);
  if (field.type !== KSB1_TYPE.unsigned) fail('KSTACK_MEMORY_FIELD_INVALID', `${label} must be unsigned`);
  return decodeShortestUnsigned(field.bytes, label);
}

export function readRawField(fields, id, label) {
  const field = fields.get(id);
  if (!field) fail('KSTACK_MEMORY_SCHEMA_MISSING_FIELD', `${label} is missing`);
  if (field.type !== KSB1_TYPE.raw) fail('KSTACK_MEMORY_FIELD_INVALID', `${label} must be raw`);
  return Buffer.from(field.bytes);
}

function assertExactFieldIds(fields, expectedIds, label) {
  for (const id of fields.keys()) {
    if (!expectedIds.includes(id)) fail('KSTACK_MEMORY_SCHEMA_UNKNOWN_FIELD', `${label} has unknown field ${id}`);
  }
  for (const id of expectedIds) {
    if (!fields.has(id)) fail('KSTACK_MEMORY_SCHEMA_MISSING_FIELD', `${label} is missing field ${id}`);
  }
}

/* ------------------------------------------------------------------------- */
/* Repository identity                                                        */
/* ------------------------------------------------------------------------- */

export const REPOSITORY_PROVIDERS = Object.freeze({
  hosted: 'github',
  localClone: 'local-git'
});

const REPOSITORY_PROVIDER_VALUES = new Set(Object.values(REPOSITORY_PROVIDERS));
const REJECTED_CLONE_SUFFIX = '.git';
const HOST_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/u;
const OWNER_OR_REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

/** Canonical lowercase ASCII IDNA A-label host. Non-ASCII always denies. */
export function canonicalHost(value) {
  if (typeof value !== 'string') fail('KSTACK_MEMORY_HOST_INVALID', 'host must be a string');
  // eslint-disable-next-line no-control-regex
  if (!/^[ -~]+$/u.test(value)) {
    fail('KSTACK_MEMORY_HOST_CONFUSABLE', 'host must be an ASCII IDNA A-label form');
  }
  const lowered = value.toLowerCase();
  if (lowered.length > LIMITS.host) fail('KSTACK_MEMORY_HOST_OVERSIZE', `host exceeds ${LIMITS.host} bytes`);
  if (lowered.endsWith('.')) fail('KSTACK_MEMORY_HOST_INVALID', 'host must not carry a trailing dot');
  const labels = lowered.split('.');
  if (labels.length < 2) fail('KSTACK_MEMORY_HOST_INVALID', 'host must be fully qualified');
  for (const label of labels) {
    if (!HOST_LABEL.test(label)) fail('KSTACK_MEMORY_HOST_INVALID', 'host label is not a valid A-label');
  }
  if (/^[0-9]+$/u.test(labels[labels.length - 1])) {
    fail('KSTACK_MEMORY_HOST_INVALID', 'host top label must not be numeric');
  }
  return lowered;
}

function canonicalOwnerOrRepository(value, label) {
  if (typeof value !== 'string') fail('KSTACK_MEMORY_ALIAS_INVALID', `${label} must be a string`);
  if (!/^[ -~]+$/u.test(value)) {
    fail('KSTACK_MEMORY_ALIAS_CONFUSABLE', `${label} must be ASCII`);
  }
  if (Buffer.byteLength(value, 'utf8') > LIMITS.ownerOrRepository) {
    fail('KSTACK_MEMORY_ALIAS_OVERSIZE', `${label} exceeds ${LIMITS.ownerOrRepository} bytes`);
  }
  if (value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    fail('KSTACK_MEMORY_ALIAS_TRAVERSAL', `${label} must not traverse paths`);
  }
  if (!OWNER_OR_REPOSITORY.test(value)) fail('KSTACK_MEMORY_ALIAS_INVALID', `${label} has invalid characters`);
  const lowered = value.toLowerCase();
  if (lowered.endsWith(REJECTED_CLONE_SUFFIX)) {
    fail('KSTACK_MEMORY_ALIAS_SUFFIX', `${label} must not carry the clone-URL suffix`);
  }
  return lowered;
}

/**
 * Canonicalize a hosted repository display alias. The alias never enters
 * `repoId`; it exists so rename/transfer, spelling, confusables, and
 * traversal forms resolve safely or deny.
 */
export function canonicalizeHostedAlias(input) {
  // Takes the caller's object rather than destructuring in the signature:
  // validating a locally rebuilt object can never observe an unknown caller
  // key, which would leave this closed schema closed in name only.
  const { host, owner, repository } = snapshotInput(input, ['host', 'owner', 'repository'], 'hosted alias');
  return {
    host: canonicalHost(host),
    owner: canonicalOwnerOrRepository(owner, 'owner'),
    repository: canonicalOwnerOrRepository(repository, 'repository')
  };
}

/**
 * Parse an `https://` remote into a canonical hosted alias. Credentials,
 * query, fragment, explicit ports, the clone-URL suffix, non-ASCII
 * confusables, and path traversal all deny.
 */
export function parseHostedRemote(remote) {
  if (typeof remote !== 'string' || remote.length === 0 || remote.length > 2048) {
    fail('KSTACK_MEMORY_REMOTE_INVALID', 'remote must be a bounded string');
  }
  if (!/^[ -~]+$/u.test(remote)) {
    fail('KSTACK_MEMORY_REMOTE_CONFUSABLE', 'remote must be ASCII');
  }
  if (!remote.startsWith('https://')) {
    fail('KSTACK_MEMORY_REMOTE_SCHEME', 'remote must use https');
  }
  if (remote.includes('?')) fail('KSTACK_MEMORY_REMOTE_QUERY', 'remote must not carry a query');
  if (remote.includes('#')) fail('KSTACK_MEMORY_REMOTE_FRAGMENT', 'remote must not carry a fragment');
  const authorityAndPath = remote.slice('https://'.length);
  if (authorityAndPath.includes('@')) {
    fail('KSTACK_MEMORY_REMOTE_CREDENTIALS', 'remote must not carry inline credentials');
  }
  const firstSlash = authorityAndPath.indexOf('/');
  if (firstSlash < 1) fail('KSTACK_MEMORY_REMOTE_INVALID', 'remote must carry a repository path');
  const authority = authorityAndPath.slice(0, firstSlash);
  if (authority.includes(':')) {
    fail('KSTACK_MEMORY_REMOTE_PORT', 'remote must not restate the implicit port');
  }
  const pathPart = authorityAndPath.slice(firstSlash + 1);
  const segments = pathPart.split('/');
  if (segments.length !== 2) fail('KSTACK_MEMORY_REMOTE_INVALID', 'remote path must be owner/repository');
  const [ownerSegment, repositorySegment] = segments;
  if (ownerSegment.length === 0 || repositorySegment.length === 0) {
    fail('KSTACK_MEMORY_REMOTE_INVALID', 'remote path segments must not be empty');
  }
  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      fail('KSTACK_MEMORY_REMOTE_TRAVERSAL', 'remote path must not traverse');
    }
  }
  if (repositorySegment.toLowerCase().endsWith(REJECTED_CLONE_SUFFIX)) {
    fail('KSTACK_MEMORY_REMOTE_SUFFIX', 'remote must not carry the clone-URL suffix');
  }
  return canonicalizeHostedAlias({
    host: authority,
    owner: ownerSegment,
    repository: repositorySegment
  });
}

/** `sha256(KSB1(schema=1, provider, canonicalHost, providerRepositoryId))`. */
export function encodeHostedRepositoryIdentity({ canonicalHost: host, providerRepositoryId }) {
  const resolvedHost = canonicalHost(host);
  const resolvedId = providerIdentifier(providerRepositoryId, 'providerRepositoryId');
  return encodeContainer({
    magic: KSB1_MAGIC,
    schema: 1,
    fields: [
      { id: 1, kind: 'text', value: REPOSITORY_PROVIDERS.hosted, maximumBytes: LIMITS.text },
      { id: 2, kind: 'text', value: resolvedHost, maximumBytes: LIMITS.host },
      { id: 3, kind: 'text', value: resolvedId, maximumBytes: LIMITS.providerIdentifier }
    ]
  });
}

/** `sha256(KSB1(schema=1, provider, localRepositoryUuid, ownerNamespace))`. */
export function encodeLocalCloneRepositoryIdentity({ localRepositoryUuid, ownerNamespace }) {
  const uuidBytes = typeof localRepositoryUuid === 'string'
    ? (HEX64.test(localRepositoryUuid)
      ? Buffer.from(localRepositoryUuid, 'hex')
      : fail('KSTACK_MEMORY_LOCAL_UUID_INVALID', 'localRepositoryUuid must be 32 raw bytes'))
    : rawBytes(localRepositoryUuid, 'localRepositoryUuid');
  if (uuidBytes.length !== 32) {
    fail('KSTACK_MEMORY_LOCAL_UUID_INVALID', 'localRepositoryUuid must be exactly 32 bytes');
  }
  const namespace = canonicalText(ownerNamespace, LIMITS.ownerOrRepository, 'ownerNamespace').text;
  return encodeContainer({
    magic: KSB1_MAGIC,
    schema: 1,
    fields: [
      { id: 1, kind: 'text', value: REPOSITORY_PROVIDERS.localClone, maximumBytes: LIMITS.text },
      { id: 2, kind: 'raw', value: uuidBytes, maximumBytes: 32 },
      { id: 3, kind: 'text', value: namespace, maximumBytes: LIMITS.ownerOrRepository }
    ]
  });
}

export function deriveRepoId(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    fail('KSTACK_MEMORY_PROVIDER_INVALID', 'repository identity must be a plain object');
  }
  // The provider decides which schema is enforced AND which encoding is used.
  // Here the copy happens FIRST and the schema is then checked against the
  // inert copy, because the key list is not known until the provider has been
  // read: copying first means that read and every later one see one value,
  // without needing a way to carry a pre-read field into the snapshot.
  const snapshot = inertCopy(input, 'repository identity');
  const provider = snapshot.provider;
  if (!REPOSITORY_PROVIDER_VALUES.has(provider)) {
    fail('KSTACK_MEMORY_PROVIDER_INVALID', 'provider is not a recognized repository provider');
  }
  const hosted = provider === REPOSITORY_PROVIDERS.hosted;
  exactKeys(
    snapshot,
    hosted
      ? ['provider', 'canonicalHost', 'providerRepositoryId']
      : ['provider', 'localRepositoryUuid', 'ownerNamespace'],
    'repository identity'
  );
  const bytes = hosted
    ? encodeHostedRepositoryIdentity(snapshot)
    : encodeLocalCloneRepositoryIdentity(snapshot);
  return { repoId: sha256Hex(bytes), canonicalBytes: bytes };
}

export function assertRepoId(value, label) {
  if (typeof value !== 'string' || !HEX64.test(value)) {
    fail('KSTACK_MEMORY_REPO_ID_INVALID', `${label} must be a 64 character lowercase hex repoId`);
  }
  return value;
}

/* ------------------------------------------------------------------------- */
/* Authority path bytes                                                       */
/* ------------------------------------------------------------------------- */

/**
 * Slash-separated, relative, non-empty, no `.` or `..` segment. Bytes are
 * raw: an authority path is never Unicode-normalized.
 */
export function canonicalAuthorityPathBytes(value) {
  const bytes = typeof value === 'string' ? Buffer.from(value, 'utf8') : rawBytes(value, 'pathBytes');
  if (bytes.length === 0) fail('KSTACK_MEMORY_PATH_INVALID', 'pathBytes must not be empty');
  if (bytes.length > LIMITS.authorityPath) {
    fail('KSTACK_MEMORY_PATH_OVERSIZE', `pathBytes exceeds ${LIMITS.authorityPath} bytes`);
  }
  if (bytes[0] === 0x2f) fail('KSTACK_MEMORY_PATH_INVALID', 'pathBytes must be relative');
  if (bytes.includes(0x00)) fail('KSTACK_MEMORY_PATH_INVALID', 'pathBytes must not contain NUL');
  if (bytes.includes(0x5c)) fail('KSTACK_MEMORY_PATH_INVALID', 'pathBytes must not contain a backslash');
  for (const byte of bytes) {
    if (byte < 0x20 || byte === 0x7f) fail('KSTACK_MEMORY_PATH_INVALID', 'pathBytes must not contain control bytes');
  }
  const segments = [];
  let start = 0;
  for (let index = 0; index <= bytes.length; index += 1) {
    if (index === bytes.length || bytes[index] === 0x2f) {
      segments.push(bytes.subarray(start, index));
      start = index + 1;
    }
  }
  for (const segment of segments) {
    if (segment.length === 0) fail('KSTACK_MEMORY_PATH_INVALID', 'pathBytes must not contain an empty segment');
    if (segment.length > LIMITS.authorityPathSegment) {
      fail('KSTACK_MEMORY_PATH_OVERSIZE', `pathBytes segment exceeds ${LIMITS.authorityPathSegment} bytes`);
    }
    const text = segment.toString('latin1');
    if (text === '.' || text === '..') fail('KSTACK_MEMORY_PATH_TRAVERSAL', 'pathBytes must not traverse');
  }
  return Buffer.from(bytes);
}

/* ------------------------------------------------------------------------- */
/* Jira canonical observation                                                 */
/* ------------------------------------------------------------------------- */

export const SCALAR_KIND = Object.freeze({
  text: 1,
  unsigned: 2,
  false: 3,
  true: 4,
  null: 5
});

const SCALAR_KIND_VALUES = new Set(Object.values(SCALAR_KIND));
const SCALAR_KIND_TO_FIELD_KIND = Object.freeze({
  1: 'text',
  2: 'unsigned',
  3: 'boolean',
  4: 'boolean',
  5: 'null'
});
export const PERMITTED_SCALAR_TYPES = Object.freeze(['text', 'unsigned', 'boolean', 'null']);

/** Classify a raw Jira scalar. Floats, objects, arrays, and undefined deny. */
export function classifyScalar(value, label) {
  if (value === null) return { scalarKind: SCALAR_KIND.null, scalarType: 'null' };
  if (value === true) return { scalarKind: SCALAR_KIND.true, scalarType: 'boolean' };
  if (value === false) return { scalarKind: SCALAR_KIND.false, scalarType: 'boolean' };
  if (typeof value === 'string') return { scalarKind: SCALAR_KIND.text, scalarType: 'text' };
  if (typeof value === 'bigint') {
    if (value < 0n) fail('KSTACK_MEMORY_SCALAR_INVALID', `${label} must not be negative`);
    return { scalarKind: SCALAR_KIND.unsigned, scalarType: 'unsigned' };
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) fail('KSTACK_MEMORY_SCALAR_FLOAT', `${label} must not be a float`);
    if (value < 0) fail('KSTACK_MEMORY_SCALAR_INVALID', `${label} must not be negative`);
    if (!Number.isSafeInteger(value)) fail('KSTACK_MEMORY_SCALAR_INVALID', `${label} exceeds safe integer range`);
    return { scalarKind: SCALAR_KIND.unsigned, scalarType: 'unsigned' };
  }
  return fail('KSTACK_MEMORY_SCALAR_INVALID', `${label} is not a permitted scalar`);
}

const SELECTED_FIELD_ENTRY_KEYS = ['fieldId', 'occurrence', 'scalarKind', 'value'];

/** Encode one `KSF1` selected-field entry. */
export function encodeSelectedFieldEntry(entry) {
  const { fieldId, occurrence, scalarKind, value } =
    snapshotInput(entry, SELECTED_FIELD_ENTRY_KEYS, 'selected field entry');
  lowerAsciiIdentifier(fieldId, LIMITS.fieldId, 'fieldId');
  const occurrenceValue = unsignedInteger(occurrence, 'occurrence');
  if (!SCALAR_KIND_VALUES.has(scalarKind)) {
    fail('KSTACK_MEMORY_SCALAR_INVALID', 'scalarKind is not a permitted scalar kind');
  }
  const fieldKind = SCALAR_KIND_TO_FIELD_KIND[scalarKind];
  const valueField = { id: 4, kind: fieldKind, value, maximumBytes: LIMITS.jiraFieldValue };
  if (scalarKind === SCALAR_KIND.true && value !== true) {
    fail('KSTACK_MEMORY_SCALAR_MISMATCH', 'scalarKind true requires the value true');
  }
  if (scalarKind === SCALAR_KIND.false && value !== false) {
    fail('KSTACK_MEMORY_SCALAR_MISMATCH', 'scalarKind false requires the value false');
  }
  if (scalarKind === SCALAR_KIND.null && value !== null) {
    fail('KSTACK_MEMORY_SCALAR_MISMATCH', 'scalarKind null requires the value null');
  }
  return encodeContainer({
    magic: KSF1_MAGIC,
    schema: 1,
    fields: [
      { id: 1, kind: 'text', value: fieldId, maximumBytes: LIMITS.fieldId },
      { id: 2, kind: 'unsigned', value: occurrenceValue },
      { id: 3, kind: 'unsigned', value: scalarKind },
      valueField
    ]
  });
}

export function decodeSelectedFieldEntry(bytes) {
  const { fields } = decodeContainer(bytes, { magic: KSF1_MAGIC, schema: 1 });
  assertExactFieldIds(fields, [1, 2, 3, 4], 'selected field entry');
  const fieldId = lowerAsciiIdentifier(readTextField(fields, 1, LIMITS.fieldId, 'fieldId'), LIMITS.fieldId, 'fieldId');
  const occurrence = readUnsignedField(fields, 2, 'occurrence');
  const scalarKind = Number(readUnsignedField(fields, 3, 'scalarKind'));
  if (!SCALAR_KIND_VALUES.has(scalarKind)) {
    fail('KSTACK_MEMORY_SCALAR_INVALID', 'scalarKind is not a permitted scalar kind');
  }
  const valueField = fields.get(4);
  let value;
  switch (scalarKind) {
    case SCALAR_KIND.text:
      value = readTextField(fields, 4, LIMITS.jiraFieldValue, 'value');
      break;
    case SCALAR_KIND.unsigned:
      value = readUnsignedField(fields, 4, 'value');
      break;
    case SCALAR_KIND.false:
      if (valueField.type !== KSB1_TYPE.false) fail('KSTACK_MEMORY_SCALAR_MISMATCH', 'value type mismatch');
      value = false;
      break;
    case SCALAR_KIND.true:
      if (valueField.type !== KSB1_TYPE.true) fail('KSTACK_MEMORY_SCALAR_MISMATCH', 'value type mismatch');
      value = true;
      break;
    default:
      if (valueField.type !== KSB1_TYPE.null) fail('KSTACK_MEMORY_SCALAR_MISMATCH', 'value type mismatch');
      value = null;
  }
  return { fieldId, occurrence: Number(occurrence), scalarKind, value };
}

function assertOccurrenceCoverage(entries) {
  const byField = new Map();
  for (const entry of entries) {
    const seen = byField.get(entry.fieldId) ?? new Set();
    if (seen.has(entry.occurrence)) {
      fail('KSTACK_MEMORY_OBSERVATION_DUPLICATE', `duplicate (fieldId, occurrence) for ${entry.fieldId}`);
    }
    seen.add(entry.occurrence);
    byField.set(entry.fieldId, seen);
  }
  for (const [fieldId, seen] of byField) {
    for (let index = 0; index < seen.size; index += 1) {
      if (!seen.has(index)) fail('KSTACK_MEMORY_OBSERVATION_GAP', `occurrence gap for ${fieldId}`);
    }
  }
}

/**
 * `uint32-be count` then `uint32-be entryLength || KSF1 entry`, sorted by
 * field ID UTF-8 bytes and then occurrence index.
 */
export function encodeSelectedFieldSequence(entries) {
  if (!Array.isArray(entries)) fail('KSTACK_MEMORY_OBSERVATION_INVALID', 'selected field sequence must be a list');
  if (entries.length > LIMITS.listElements) {
    fail('KSTACK_MEMORY_OBSERVATION_OVERSIZE', 'selected field sequence exceeds the list bound');
  }
  const copiedEntries = inertCopy(entries, 'selected field entries');
  const prepared = [];
  for (let entryIndex = 0; entryIndex < copiedEntries.length; entryIndex += 1) {
    const rawEntry = copiedEntries[entryIndex];
    // Snapshot before encoding so the bytes that get emitted, the key this
    // entry is sorted under, and the pair the duplicate/gap check sees all come
    // from one read. Re-reading would let an entry encode one field ID while
    // being ordered and deduplicated under another, which would break canonical
    // determinism outright.
    const entry = snapshotInput(rawEntry, SELECTED_FIELD_ENTRY_KEYS, 'selected field entry');
    const bytes = encodeSelectedFieldEntry(entry);
    prepared.push({
      fieldId: entry.fieldId,
      occurrence: Number(unsignedInteger(entry.occurrence, 'occurrence')),
      sortKey: Buffer.from(entry.fieldId, 'utf8'),
      bytes
    });
  }
  assertOccurrenceCoverage(prepared);
  prepared.sort((left, right) => {
    const byField = Buffer.compare(left.sortKey, right.sortKey);
    if (byField !== 0) return byField;
    return left.occurrence - right.occurrence;
  });
  const count = Buffer.alloc(4);
  count.writeUInt32BE(prepared.length, 0);
  const chunks = [count];
  for (const entry of prepared) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(entry.bytes.length, 0);
    chunks.push(length, entry.bytes);
  }
  const encoded = Buffer.concat(chunks);
  if (encoded.length > LIMITS.canonicalObservation) {
    fail('KSTACK_MEMORY_OBSERVATION_OVERSIZE', 'selected field sequence exceeds the canonical bound');
  }
  return encoded;
}

export function decodeSelectedFieldSequence(bytes) {
  const buffer = rawBytes(bytes, 'selected field sequence');
  if (buffer.length < 4) fail('KSTACK_MEMORY_OBSERVATION_INVALID', 'selected field sequence is truncated');
  const count = buffer.readUInt32BE(0);
  if (count > LIMITS.listElements) {
    fail('KSTACK_MEMORY_OBSERVATION_OVERSIZE', 'selected field sequence exceeds the list bound');
  }
  const entries = [];
  let offset = 4;
  for (let index = 0; index < count; index += 1) {
    if (buffer.length - offset < 4) fail('KSTACK_MEMORY_OBSERVATION_INVALID', 'entry length is truncated');
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    if (length > buffer.length - offset) fail('KSTACK_MEMORY_OBSERVATION_INVALID', 'entry declares more bytes than remain');
    entries.push(decodeSelectedFieldEntry(buffer.subarray(offset, offset + length)));
    offset += length;
  }
  if (offset !== buffer.length) fail('KSTACK_MEMORY_OBSERVATION_INVALID', 'selected field sequence has trailing bytes');
  assertOccurrenceCoverage(entries);
  const reencoded = encodeSelectedFieldSequence(entries.map((entry) => ({
    fieldId: entry.fieldId,
    occurrence: entry.occurrence,
    scalarKind: entry.scalarKind,
    value: entry.value
  })));
  if (!reencoded.equals(buffer)) {
    fail('KSTACK_MEMORY_OBSERVATION_NON_CANONICAL', 'selected field sequence is not in canonical order');
  }
  return entries;
}

const JIRA_OBSERVATION_KEYS = [
  'siteId', 'projectId', 'issueId', 'issueKeyAtObservation', 'fieldSetId',
  'sourceRevision', 'jiraUpdated', 'observedAt', 'selectedFieldSequence'
];

/**
 * Closed Jira observation schema:
 * `1 siteId, 2 projectId, 3 issueId, 4 issueKeyAtObservation, 5 fieldSetId,
 *  6 sourceRevision(text|null), 7 jiraUpdated, 8 observedAt,
 *  9 selectedFieldSequence(raw)`.
 */
export function encodeJiraObservation(input) {
  const snapshot = snapshotInput(input, JIRA_OBSERVATION_KEYS, 'jira observation');
  const sequence = rawBytes(snapshot.selectedFieldSequence, 'selectedFieldSequence');
  const sourceRevision = snapshot.sourceRevision;
  const revisionField = sourceRevision === null
    ? { id: 6, kind: 'null', value: null }
    : { id: 6, kind: 'text', value: providerIdentifier(sourceRevision, 'sourceRevision'), maximumBytes: LIMITS.providerIdentifier };
  const bytes = encodeContainer({
    magic: KSB1_MAGIC,
    schema: 1,
    fields: [
      { id: 1, kind: 'text', value: providerIdentifier(snapshot.siteId, 'siteId'), maximumBytes: LIMITS.providerIdentifier },
      { id: 2, kind: 'text', value: providerIdentifier(snapshot.projectId, 'projectId'), maximumBytes: LIMITS.providerIdentifier },
      { id: 3, kind: 'text', value: providerIdentifier(snapshot.issueId, 'issueId'), maximumBytes: LIMITS.providerIdentifier },
      { id: 4, kind: 'text', value: providerIdentifier(snapshot.issueKeyAtObservation, 'issueKeyAtObservation'), maximumBytes: LIMITS.providerIdentifier },
      { id: 5, kind: 'text', value: canonicalText(snapshot.fieldSetId, LIMITS.text, 'fieldSetId').text, maximumBytes: LIMITS.text },
      revisionField,
      { id: 7, kind: 'text', value: canonicalTimestamp(snapshot.jiraUpdated, 'jiraUpdated').text, maximumBytes: LIMITS.text },
      { id: 8, kind: 'text', value: canonicalTimestamp(snapshot.observedAt, 'observedAt').text, maximumBytes: LIMITS.text },
      { id: 9, kind: 'raw', value: sequence, maximumBytes: LIMITS.canonicalObservation }
    ]
  });
  if (bytes.length > LIMITS.canonicalObservation) {
    fail('KSTACK_MEMORY_OBSERVATION_OVERSIZE', 'canonical observation exceeds 4 MiB');
  }
  return {
    bytes,
    observationSha256: sha256Hex(bytes),
    selectedFieldsSha256: sha256Hex(sequence)
  };
}

export function decodeJiraObservation(bytes) {
  const { fields } = decodeContainer(bytes, { magic: KSB1_MAGIC, schema: 1 });
  assertExactFieldIds(fields, [1, 2, 3, 4, 5, 6, 7, 8, 9], 'jira observation');
  const revisionField = fields.get(6);
  let sourceRevision = null;
  if (revisionField.type === KSB1_TYPE.text) {
    sourceRevision = providerIdentifier(readTextField(fields, 6, LIMITS.providerIdentifier, 'sourceRevision'), 'sourceRevision');
  } else if (revisionField.type !== KSB1_TYPE.null) {
    fail('KSTACK_MEMORY_FIELD_INVALID', 'sourceRevision must be text or null');
  }
  const sequence = readRawField(fields, 9, 'selectedFieldSequence');
  return {
    siteId: providerIdentifier(readTextField(fields, 1, LIMITS.providerIdentifier, 'siteId'), 'siteId'),
    projectId: providerIdentifier(readTextField(fields, 2, LIMITS.providerIdentifier, 'projectId'), 'projectId'),
    issueId: providerIdentifier(readTextField(fields, 3, LIMITS.providerIdentifier, 'issueId'), 'issueId'),
    issueKeyAtObservation: providerIdentifier(readTextField(fields, 4, LIMITS.providerIdentifier, 'issueKeyAtObservation'), 'issueKeyAtObservation'),
    fieldSetId: readTextField(fields, 5, LIMITS.text, 'fieldSetId'),
    sourceRevision,
    jiraUpdated: canonicalTimestamp(readTextField(fields, 7, LIMITS.text, 'jiraUpdated'), 'jiraUpdated').text,
    observedAt: canonicalTimestamp(readTextField(fields, 8, LIMITS.text, 'observedAt'), 'observedAt').text,
    selectedFieldSequence: sequence,
    entries: decodeSelectedFieldSequence(sequence),
    selectedFieldsSha256: sha256Hex(sequence)
  };
}

/* ------------------------------------------------------------------------- */
/* Versioned field-set policy                                                 */
/* ------------------------------------------------------------------------- */

const FIELD_SET_KEYS = ['fieldSetId', 'fieldSetVersion', 'freshForSeconds', 'serveForSeconds', 'fields'];
const FIELD_SET_FIELD_KEYS = ['fieldId', 'multiplicity', 'scalarTypes', 'pointer', 'required'];
const MULTIPLICITIES = new Set(['single', 'ordered-array']);

export function parseFieldSet(input) {
  const snapshot = snapshotInput(input, FIELD_SET_KEYS, 'field set');
  const fieldSetId = canonicalText(snapshot.fieldSetId, LIMITS.text, 'fieldSetId').text;
  const fieldSetVersion = Number(unsignedInteger(snapshot.fieldSetVersion, 'fieldSetVersion'));
  const { freshForSeconds, serveForSeconds } = parseFreshnessPolicy({
    freshForSeconds: snapshot.freshForSeconds,
    serveForSeconds: snapshot.serveForSeconds
  });
  const rawFieldList = snapshot.fields;
  if (!Array.isArray(rawFieldList) || rawFieldList.length === 0) {
    fail('KSTACK_MEMORY_FIELD_SET_INVALID', 'field set must declare fields');
  }
  if (rawFieldList.length > LIMITS.listElements) {
    fail('KSTACK_MEMORY_FIELD_SET_INVALID', 'field set exceeds the list bound');
  }
  const seen = new Set();
  const fields = rawFieldList.map((rawField) => {
    // Each element is its own caller-supplied object and gets its own snapshot:
    // the allowlist this field set enforces later must be the one validated here.
    const field = snapshotInput(rawField, FIELD_SET_FIELD_KEYS, 'field set field');
    const fieldId = lowerAsciiIdentifier(field.fieldId, LIMITS.fieldId, 'fieldId');
    if (seen.has(fieldId)) fail('KSTACK_MEMORY_FIELD_SET_INVALID', `duplicate field ${fieldId}`);
    seen.add(fieldId);
    if (!MULTIPLICITIES.has(field.multiplicity)) {
      fail('KSTACK_MEMORY_FIELD_SET_INVALID', `${fieldId} has an unknown multiplicity`);
    }
    if (!Array.isArray(field.scalarTypes) || field.scalarTypes.length === 0) {
      fail('KSTACK_MEMORY_FIELD_SET_INVALID', `${fieldId} must permit at least one scalar type`);
    }
    for (const scalarType of field.scalarTypes) {
      if (!PERMITTED_SCALAR_TYPES.includes(scalarType)) {
        fail('KSTACK_MEMORY_FIELD_SET_INVALID', `${fieldId} permits an unknown scalar type`);
      }
    }
    if (field.pointer !== null && typeof field.pointer !== 'string') {
      fail('KSTACK_MEMORY_FIELD_SET_INVALID', `${fieldId} pointer must be a string or null`);
    }
    if (typeof field.pointer === 'string' && !field.pointer.startsWith('/')) {
      fail('KSTACK_MEMORY_FIELD_SET_INVALID', `${fieldId} pointer must be a JSON Pointer`);
    }
    if (typeof field.required !== 'boolean') {
      fail('KSTACK_MEMORY_FIELD_SET_INVALID', `${fieldId} required must be boolean`);
    }
    return Object.freeze({
      fieldId,
      multiplicity: field.multiplicity,
      scalarTypes: Object.freeze([...field.scalarTypes]),
      pointer: field.pointer,
      required: field.required
    });
  });
  const policy = Object.freeze({
    fieldSetId, fieldSetVersion, freshForSeconds, serveForSeconds, fields: Object.freeze(fields)
  });
  VALIDATED_FIELD_SETS.add(policy);
  return policy;
}

function resolveJsonPointerLeaf(value, pointer, label) {
  if (pointer === null) return value;
  const segments = pointer.slice(1).split('/').map((segment) => segment.replace(/~1/gu, '/').replace(/~0/gu, '~'));
  let current = value;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) {
      fail('KSTACK_MEMORY_OBSERVATION_SHAPE', `${label} pointer does not resolve to a fixed leaf`);
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      fail('KSTACK_MEMORY_OBSERVATION_SHAPE', `${label} pointer segment is absent`);
    }
    current = current[segment];
  }
  return current;
}

/**
 * Project a raw Jira field snapshot through a versioned field set into
 * canonical selected-field entries. Any violation rejects the complete
 * snapshot rather than dropping a field.
 */
export function projectJiraFieldSet(fieldSet, rawFields) {
  // Only a policy this module's own parser produced may skip revalidation.
  const policy = VALIDATED_FIELD_SETS.has(fieldSet) ? fieldSet : parseFieldSet(fieldSet);
  if (rawFields === null || typeof rawFields !== 'object' || Array.isArray(rawFields)) {
    fail('KSTACK_MEMORY_OBSERVATION_SHAPE', 'raw fields must be a plain object');
  }
  // Jira response data is untrusted by the accepted design, so it crosses the
  // same boundary as everything else BEFORE anything iterates it. Without this
  // the occurrence loop below dispatches through the caller's own `forEach`,
  // which can both ignore the length bound and substitute elements that the
  // bound check never saw.
  // Guarded before the copy: `inertCopy` would turn a view into a Buffer, and
  // the `Object.keys` below would then enumerate one key per byte.
  assertEnumerableInput(rawFields, 'raw fields');
  rawFields = inertCopy(rawFields, 'raw fields');
  const declared = new Map(policy.fields.map((field) => [field.fieldId, field]));
  for (const key of Object.keys(rawFields)) {
    if (!declared.has(key)) {
      fail('KSTACK_MEMORY_OBSERVATION_UNKNOWN_FIELD', `field ${key} is not in the versioned field set`);
    }
  }
  const entries = [];
  for (const field of policy.fields) {
    const present = Object.prototype.hasOwnProperty.call(rawFields, field.fieldId);
    if (!present) {
      if (field.required) {
        fail('KSTACK_MEMORY_OBSERVATION_MISSING_FIELD', `required field ${field.fieldId} is absent`);
      }
      continue;
    }
    const raw = rawFields[field.fieldId];
    const occurrences = field.multiplicity === 'ordered-array'
      ? (Array.isArray(raw) ? raw : fail('KSTACK_MEMORY_OBSERVATION_SHAPE', `${field.fieldId} must be an ordered array`))
      : (Array.isArray(raw) ? fail('KSTACK_MEMORY_OBSERVATION_SHAPE', `${field.fieldId} must be a single scalar`) : [raw]);
    if (occurrences.length > LIMITS.listElements) {
      fail('KSTACK_MEMORY_OBSERVATION_OVERSIZE', `${field.fieldId} exceeds the list bound`);
    }
    // Indexed loop, not `forEach`: `occurrences` may be the inert copy of a
    // caller array, and dispatching through a method is the thing this module
    // never does with caller-derived containers.
    for (let index = 0; index < occurrences.length; index += 1) {
      const element = occurrences[index];
      if (Array.isArray(element)) {
        fail('KSTACK_MEMORY_OBSERVATION_SHAPE', `${field.fieldId} must not contain a nested array`);
      }
      const leaf = resolveJsonPointerLeaf(element, field.pointer, field.fieldId);
      if (Array.isArray(leaf) || (leaf !== null && typeof leaf === 'object')) {
        fail('KSTACK_MEMORY_OBSERVATION_SHAPE', `${field.fieldId} must resolve to a permitted scalar`);
      }
      const { scalarKind, scalarType } = classifyScalar(leaf, field.fieldId);
      if (!field.scalarTypes.includes(scalarType)) {
        fail('KSTACK_MEMORY_OBSERVATION_TYPE_MISMATCH', `${field.fieldId} does not permit ${scalarType}`);
      }
      entries.push({ fieldId: field.fieldId, occurrence: index, scalarKind, value: leaf });
    }
  }
  return entries;
}

/* ------------------------------------------------------------------------- */
/* Authority locators                                                         */
/* ------------------------------------------------------------------------- */

export const AUTHORITY_KINDS = Object.freeze(['source-control', 'jira']);

const SOURCE_CONTROL_LOCATOR_KEYS = [
  'repoId', 'providerRepositoryId', 'commitSha40', 'pathBytes',
  'blobOid', 'byteLength', 'contentSha256', 'artifactClass'
];

/**
 * Closed source-control authority locator. Only a full 40 character commit is
 * accepted; abbreviated identifiers deny.
 */
export function parseSourceControlLocator(input) {
  const snapshot = snapshotInput(input, SOURCE_CONTROL_LOCATOR_KEYS, 'source-control locator');
  if (typeof snapshot.commitSha40 !== 'string' || !HEX40.test(snapshot.commitSha40)) {
    fail('KSTACK_MEMORY_LOCATOR_INVALID', 'commitSha40 must be a full 40 character lowercase commit identifier');
  }
  if (typeof snapshot.blobOid !== 'string' || !(HEX40.test(snapshot.blobOid) || HEX64.test(snapshot.blobOid))) {
    fail('KSTACK_MEMORY_LOCATOR_INVALID', 'blobOid must be a full object identifier');
  }
  return Object.freeze({
    repoId: assertRepoId(snapshot.repoId, 'repoId'),
    providerRepositoryId: providerIdentifier(snapshot.providerRepositoryId, 'providerRepositoryId'),
    commitSha40: snapshot.commitSha40,
    pathBytes: canonicalAuthorityPathBytes(snapshot.pathBytes),
    blobOid: snapshot.blobOid,
    byteLength: Number(unsignedInteger(snapshot.byteLength, 'byteLength')),
    contentSha256: hexDigest32(snapshot.contentSha256, 'contentSha256'),
    artifactClass: lowerAsciiIdentifier(snapshot.artifactClass, LIMITS.artifactClass, 'artifactClass')
  });
}

const JIRA_LOCATOR_KEYS = [
  'siteId', 'projectId', 'issueId', 'issueKeyAtObservation', 'fieldSetId',
  'sourceRevision', 'jiraUpdated', 'observedAt', 'selectedFieldsSha256'
];

export function parseJiraLocator(input) {
  const snapshot = snapshotInput(input, JIRA_LOCATOR_KEYS, 'jira locator');
  if (snapshot.sourceRevision !== null) providerIdentifier(snapshot.sourceRevision, 'sourceRevision');
  return Object.freeze({
    siteId: providerIdentifier(snapshot.siteId, 'siteId'),
    projectId: providerIdentifier(snapshot.projectId, 'projectId'),
    issueId: providerIdentifier(snapshot.issueId, 'issueId'),
    issueKeyAtObservation: providerIdentifier(snapshot.issueKeyAtObservation, 'issueKeyAtObservation'),
    fieldSetId: canonicalText(snapshot.fieldSetId, LIMITS.text, 'fieldSetId').text,
    sourceRevision: snapshot.sourceRevision,
    jiraUpdated: canonicalTimestamp(snapshot.jiraUpdated, 'jiraUpdated').text,
    observedAt: canonicalTimestamp(snapshot.observedAt, 'observedAt').text,
    selectedFieldsSha256: hexDigest32(snapshot.selectedFieldsSha256, 'selectedFieldsSha256')
  });
}

export function parseAuthorityLocator(authorityKind, locator) {
  if (!AUTHORITY_KINDS.includes(authorityKind)) {
    fail('KSTACK_MEMORY_LOCATOR_INVALID', 'authorityKind is not recognized');
  }
  return authorityKind === 'jira' ? parseJiraLocator(locator) : parseSourceControlLocator(locator);
}

/* ------------------------------------------------------------------------- */
/* Catalog record                                                             */
/* ------------------------------------------------------------------------- */

export const FRESHNESS_STATES = Object.freeze(['fresh', 'stale', 'unavailable', 'expired', 'deleted']);
export const RECORD_STATUSES = Object.freeze(['active', 'superseded', 'quarantined', 'deleted']);
export const SENSITIVITY_CLASSES = Object.freeze(['internal', 'production', 'user-data']);
export const RESTRICTED_SENSITIVITY_CLASSES = Object.freeze(['production', 'user-data']);

const SOURCE_RECORD_KEYS = [
  'schemaVersion', 'recordId', 'repoId', 'authorityKind', 'authorityLocator',
  'artifactClass', 'activationEpoch', 'status',
  'originalByteLength', 'originalSha256', 'canonicalMetadataSha256', 'receiptId',
  'ciphertextReference', 'keyReference',
  'policyVersion', 'fieldSetVersion', 'retentionClass', 'sensitivityClass',
  'authorizedRepositoryIds', 'deletionLineageId',
  'sourceTime', 'observedAt', 'activatedAt', 'lastVerifiedAt', 'freshnessState',
  'priorRecordId', 'successorRecordId', 'lineageReason'
];

/** Fields that must never appear in a catalog record. */
export const FORBIDDEN_CATALOG_KEYS = Object.freeze([
  'credentials', 'token', 'secret', 'password', 'jiraBody', 'body', 'prompt',
  'summary', 'generatedSummary', 'authorityDecision', 'providerFilter'
]);

function optionalIdentifier(value, label, maximumBytes = LIMITS.text) {
  if (value === null) return null;
  return canonicalText(value, maximumBytes, label).text;
}

function optionalRecordId(value, label) {
  if (value === null) return null;
  if (typeof value !== 'string' || !HEX32.test(value)) {
    fail('KSTACK_MEMORY_RECORD_INVALID', `${label} must be a 32 character lowercase hex record ID`);
  }
  return value;
}

export function parseSourceRecordV1(input) {
  const snapshot = snapshotInput(input, SOURCE_RECORD_KEYS, 'SourceRecordV1');
  // Key presence only — reads no caller-controlled values.
  for (const forbidden of FORBIDDEN_CATALOG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, forbidden)) {
      fail('KSTACK_MEMORY_RECORD_FORBIDDEN_FIELD', `SourceRecordV1 must not carry ${forbidden}`);
    }
  }
  if (snapshot.schemaVersion !== 1) fail('KSTACK_MEMORY_RECORD_INVALID', 'schemaVersion must be 1');
  if (!RECORD_STATUSES.includes(snapshot.status)) fail('KSTACK_MEMORY_RECORD_INVALID', 'status is not recognized');
  if (!FRESHNESS_STATES.includes(snapshot.freshnessState)) {
    fail('KSTACK_MEMORY_RECORD_INVALID', 'freshnessState is not recognized');
  }
  if (!SENSITIVITY_CLASSES.includes(snapshot.sensitivityClass)) {
    fail('KSTACK_MEMORY_RECORD_INVALID', 'sensitivityClass is not recognized');
  }
  // A record cannot be simultaneously active and deleted. Without this, a
  // record labelled `deleted` but left `active` would be recomputed as fresh
  // and emitted, defeating the deleted-items omission rule.
  if ((snapshot.status === 'deleted') !== (snapshot.freshnessState === 'deleted')) {
    fail('KSTACK_MEMORY_RECORD_INVALID', 'status and freshnessState must agree on deletion');
  }
  if (!Array.isArray(snapshot.authorizedRepositoryIds) || snapshot.authorizedRepositoryIds.length > LIMITS.listElements) {
    fail('KSTACK_MEMORY_RECORD_INVALID', 'authorizedRepositoryIds must be a bounded list');
  }
  const authorized = snapshot.authorizedRepositoryIds.map((value) => assertRepoId(value, 'authorizedRepositoryIds entry'));
  if (new Set(authorized).size !== authorized.length) {
    fail('KSTACK_MEMORY_RECORD_INVALID', 'authorizedRepositoryIds must not repeat');
  }
  const record = Object.freeze({
    schemaVersion: 1,
    recordId: optionalRecordId(snapshot.recordId, 'recordId')
      ?? fail('KSTACK_MEMORY_RECORD_INVALID', 'recordId is required'),
    repoId: assertRepoId(snapshot.repoId, 'repoId'),
    authorityKind: AUTHORITY_KINDS.includes(snapshot.authorityKind)
      ? snapshot.authorityKind
      : fail('KSTACK_MEMORY_RECORD_INVALID', 'authorityKind is not recognized'),
    authorityLocator: parseAuthorityLocator(snapshot.authorityKind, snapshot.authorityLocator),
    artifactClass: lowerAsciiIdentifier(snapshot.artifactClass, LIMITS.artifactClass, 'artifactClass'),
    activationEpoch: Number(unsignedInteger(snapshot.activationEpoch, 'activationEpoch')),
    status: snapshot.status,
    originalByteLength: Number(unsignedInteger(snapshot.originalByteLength, 'originalByteLength')),
    originalSha256: hexDigest32(snapshot.originalSha256, 'originalSha256'),
    canonicalMetadataSha256: hexDigest32(snapshot.canonicalMetadataSha256, 'canonicalMetadataSha256'),
    receiptId: canonicalText(snapshot.receiptId, LIMITS.text, 'receiptId').text,
    ciphertextReference: optionalIdentifier(snapshot.ciphertextReference, 'ciphertextReference'),
    keyReference: optionalIdentifier(snapshot.keyReference, 'keyReference'),
    policyVersion: Number(unsignedInteger(snapshot.policyVersion, 'policyVersion')),
    fieldSetVersion: snapshot.fieldSetVersion === null
      ? null
      : Number(unsignedInteger(snapshot.fieldSetVersion, 'fieldSetVersion')),
    retentionClass: lowerAsciiIdentifier(snapshot.retentionClass, LIMITS.artifactClass, 'retentionClass'),
    sensitivityClass: snapshot.sensitivityClass,
    authorizedRepositoryIds: Object.freeze(authorized),
    deletionLineageId: optionalIdentifier(snapshot.deletionLineageId, 'deletionLineageId'),
    sourceTime: canonicalTimestamp(snapshot.sourceTime, 'sourceTime').text,
    observedAt: canonicalTimestamp(snapshot.observedAt, 'observedAt').text,
    activatedAt: canonicalTimestamp(snapshot.activatedAt, 'activatedAt').text,
    lastVerifiedAt: canonicalTimestamp(snapshot.lastVerifiedAt, 'lastVerifiedAt').text,
    freshnessState: snapshot.freshnessState,
    priorRecordId: optionalRecordId(snapshot.priorRecordId, 'priorRecordId'),
    successorRecordId: optionalRecordId(snapshot.successorRecordId, 'successorRecordId'),
    lineageReason: optionalIdentifier(snapshot.lineageReason, 'lineageReason')
  });
  VALIDATED_SOURCE_RECORDS.add(record);
  return record;
}

/**
 * The scope a record actually occupies, taken from its own validated
 * authority locator. This is the only value grant and path-prefix matching may
 * use: a caller-supplied scope is an assertion, never authority.
 *
 * A Jira scope is a project identifier, which has no path structure, so it
 * matches exactly and never as a `/`-delimited prefix. A source-control scope
 * is the record's raw authority path bytes.
 */
export function deriveRecordScope(record) {
  if (!VALIDATED_SOURCE_RECORDS.has(record)) {
    fail('KSTACK_MEMORY_RECORD_INVALID', 'scope may only be derived from a validated record');
  }
  return record.authorityKind === 'jira'
    ? { bytes: Buffer.from(record.authorityLocator.projectId, 'utf8'), exactOnly: true }
    : { bytes: Buffer.from(record.authorityLocator.pathBytes), exactOnly: false };
}

/** Exactly one active record per locator lineage. */
export function assertSingleActivePerLineage(records) {
  if (!Array.isArray(records)) {
    fail('KSTACK_MEMORY_RECORD_INVALID', 'records must be a list');
  }
  // Deliberately NOT `inertCopy`-ed. These elements are already this module's
  // own frozen, validated output, and copying them would produce new objects
  // that are no longer the ones held in VALIDATED_SOURCE_RECORDS — which is
  // exactly what previously forced a second read of the caller's array to
  // perform the marker check, reintroducing the read-twice defect this module
  // exists to prevent.
  //
  // The discipline instead is the one used everywhere else: one read of
  // `length`, one read per slot into a local, and every subsequent use — marker
  // check, status, lineage key, recordId — against that same local.
  const length = records.length;
  if (!Number.isInteger(length) || length < 0 || length > LIMITS.listElements) {
    fail('KSTACK_MEMORY_RECORD_INVALID', 'records exceed the list bound');
  }
  const active = new Map();
  for (let index = 0; index < length; index += 1) {
    const record = records[index];
    if (!VALIDATED_SOURCE_RECORDS.has(record)) {
      fail('KSTACK_MEMORY_RECORD_INVALID', 'lineage may only be asserted over validated records');
    }
    if (record.status !== 'active') continue;
    const lineage = locatorLineageKey(record);
    if (active.has(lineage)) {
      fail('KSTACK_MEMORY_LINEAGE_CONFLICT', 'more than one active record for a locator lineage');
    }
    active.set(lineage, record.recordId);
  }
  return active;
}

export function locatorLineageKey(record) {
  if (!VALIDATED_SOURCE_RECORDS.has(record)) {
    fail('KSTACK_MEMORY_RECORD_INVALID', 'a lineage key may only be derived from a validated record');
  }
  const locator = record.authorityLocator;
  if (record.authorityKind === 'jira') {
    return `${record.repoId}\u0000jira\u0000${locator.siteId}\u0000${locator.issueId}\u0000${locator.fieldSetId}`;
  }
  return `${record.repoId}\u0000source-control\u0000${locator.providerRepositoryId}\u0000${locator.pathBytes.toString('hex')}`;
}

/* ------------------------------------------------------------------------- */
/* Citation contract                                                          */
/* ------------------------------------------------------------------------- */

export const TRUST_LABEL = 'UNTRUSTED_RETRIEVED_DATA';
export const RETRIEVAL_CHANNELS = Object.freeze(['raw-exact', 'bm25']);

const CITED_RESULT_KEYS = [
  'resultId', 'requestRepoId', 'sourceRecordId', 'authorityKind', 'authorityLocator',
  'sourceRevision', 'observedAt', 'freshnessState', 'originalContentSha256',
  'chunkByteStart', 'chunkByteEndExclusive', 'chunkSha256', 'retrievalChannels',
  'componentScores', 'policyGeneration', 'derivationReceiptIds', 'trustLabel'
];

export function parseCitedResultV1(input) {
  const snapshot = snapshotInput(input, CITED_RESULT_KEYS, 'CitedResultV1');
  if (snapshot.trustLabel !== TRUST_LABEL) {
    fail('KSTACK_MEMORY_CITATION_INVALID', `trustLabel must be ${TRUST_LABEL}`);
  }
  if (!AUTHORITY_KINDS.includes(snapshot.authorityKind)) {
    fail('KSTACK_MEMORY_CITATION_INVALID', 'authorityKind is not recognized');
  }
  if (!FRESHNESS_STATES.includes(snapshot.freshnessState)) {
    fail('KSTACK_MEMORY_CITATION_INVALID', 'freshnessState is not recognized');
  }
  const start = Number(unsignedInteger(snapshot.chunkByteStart, 'chunkByteStart'));
  const end = Number(unsignedInteger(snapshot.chunkByteEndExclusive, 'chunkByteEndExclusive'));
  if (end <= start) fail('KSTACK_MEMORY_CITATION_RANGE', 'chunk range must be a non-empty half-open range');
  const retrievalChannels = snapshot.retrievalChannels;
  if (!Array.isArray(retrievalChannels) || retrievalChannels.length === 0) {
    fail('KSTACK_MEMORY_CITATION_INVALID', 'retrievalChannels must be a non-empty list');
  }
  for (const channel of retrievalChannels) {
    if (!RETRIEVAL_CHANNELS.includes(channel)) {
      fail('KSTACK_MEMORY_CITATION_CHANNEL', 'retrievalChannels is limited to raw-exact and bm25');
    }
  }
  if (new Set(retrievalChannels).size !== retrievalChannels.length) {
    fail('KSTACK_MEMORY_CITATION_INVALID', 'retrievalChannels must not repeat');
  }
  // Open-keyed, so it is snapshotted by enumeration rather than by allowlist.
  const componentScores = snapshotOpenObject(snapshot.componentScores, 'componentScores');
  for (const [channel, score] of Object.entries(componentScores)) {
    if (!RETRIEVAL_CHANNELS.includes(channel)) {
      fail('KSTACK_MEMORY_CITATION_CHANNEL', 'componentScores may only score permitted channels');
    }
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      fail('KSTACK_MEMORY_CITATION_INVALID', 'componentScores must be finite numbers');
    }
  }
  const derivationReceiptIds = snapshot.derivationReceiptIds;
  if (!Array.isArray(derivationReceiptIds) || derivationReceiptIds.length > LIMITS.listElements) {
    fail('KSTACK_MEMORY_CITATION_INVALID', 'derivationReceiptIds must be a bounded list');
  }
  return Object.freeze({
    resultId: optionalRecordId(snapshot.resultId, 'resultId')
      ?? fail('KSTACK_MEMORY_CITATION_INVALID', 'resultId is required'),
    requestRepoId: assertRepoId(snapshot.requestRepoId, 'requestRepoId'),
    sourceRecordId: optionalRecordId(snapshot.sourceRecordId, 'sourceRecordId')
      ?? fail('KSTACK_MEMORY_CITATION_INVALID', 'sourceRecordId is required'),
    authorityKind: snapshot.authorityKind,
    authorityLocator: parseAuthorityLocator(snapshot.authorityKind, snapshot.authorityLocator),
    sourceRevision: snapshot.sourceRevision === null ? null : providerIdentifier(snapshot.sourceRevision, 'sourceRevision'),
    observedAt: canonicalTimestamp(snapshot.observedAt, 'observedAt').text,
    freshnessState: snapshot.freshnessState,
    originalContentSha256: hexDigest32(snapshot.originalContentSha256, 'originalContentSha256'),
    chunkByteStart: start,
    chunkByteEndExclusive: end,
    chunkSha256: hexDigest32(snapshot.chunkSha256, 'chunkSha256'),
    retrievalChannels: Object.freeze([...retrievalChannels]),
    componentScores: Object.freeze({ ...componentScores }),
    policyGeneration: Number(unsignedInteger(snapshot.policyGeneration, 'policyGeneration')),
    derivationReceiptIds: Object.freeze(derivationReceiptIds.map((value) => canonicalText(value, LIMITS.text, 'derivationReceiptIds entry').text)),
    trustLabel: TRUST_LABEL
  });
}

/**
 * Verify a citation range against digest-verified original bytes. Returns the
 * exact range or fails; a mismatch never yields a substitute.
 */
export function verifyCitedRange({ originalBytes, originalContentSha256, chunkByteStart, chunkByteEndExclusive, chunkSha256, requireUtf8Boundary = true }) {
  const bytes = rawBytes(originalBytes, 'originalBytes');
  if (sha256Hex(bytes) !== hexDigest32(originalContentSha256, 'originalContentSha256')) {
    fail('KSTACK_MEMORY_CITATION_DIGEST_MISMATCH', 'original bytes do not match the recorded digest');
  }
  const start = Number(unsignedInteger(chunkByteStart, 'chunkByteStart'));
  const end = Number(unsignedInteger(chunkByteEndExclusive, 'chunkByteEndExclusive'));
  if (end <= start || end > bytes.length) {
    fail('KSTACK_MEMORY_CITATION_RANGE', 'chunk range is outside the original bytes');
  }
  const chunk = bytes.subarray(start, end);
  if (requireUtf8Boundary && !isUtf8BoundaryAligned(bytes, start, end)) {
    fail('KSTACK_MEMORY_CITATION_RANGE', 'chunk range is not UTF-8 boundary aligned');
  }
  if (sha256Hex(chunk) !== hexDigest32(chunkSha256, 'chunkSha256')) {
    fail('KSTACK_MEMORY_CITATION_DIGEST_MISMATCH', 'chunk bytes do not match the recorded digest');
  }
  return Buffer.from(chunk);
}

function isContinuationByte(byte) {
  return (byte & 0xc0) === 0x80;
}

export function isUtf8BoundaryAligned(bytes, start, end) {
  if (start > 0 && isContinuationByte(bytes[start])) return false;
  if (end < bytes.length && isContinuationByte(bytes[end])) return false;
  try {
    FATAL_UTF8.decode(bytes.subarray(start, end));
  } catch {
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------------- */
/* Freshness state machine                                                    */
/* ------------------------------------------------------------------------- */

export const FRESHNESS_BOUNDS = Object.freeze({ minimumSeconds: 60, maximumSeconds: 2_592_000 });
export const CLOCK_REGRESSION_TOLERANCE_MILLISECONDS = 1000;

export function parseFreshnessPolicy({ freshForSeconds, serveForSeconds }) {
  for (const [label, value] of [['freshForSeconds', freshForSeconds], ['serveForSeconds', serveForSeconds]]) {
    if (!Number.isInteger(value) || value < FRESHNESS_BOUNDS.minimumSeconds || value > FRESHNESS_BOUNDS.maximumSeconds) {
      fail('KSTACK_MEMORY_FRESHNESS_POLICY_INVALID', `${label} must be an integer in ${FRESHNESS_BOUNDS.minimumSeconds}..${FRESHNESS_BOUNDS.maximumSeconds}`);
    }
  }
  if (serveForSeconds < freshForSeconds) {
    fail('KSTACK_MEMORY_FRESHNESS_POLICY_INVALID', 'serveForSeconds must be at least freshForSeconds');
  }
  return { freshForSeconds, serveForSeconds };
}

const FRESHNESS_INPUT_KEYS = [
  'observedAt', 'freshForSeconds', 'serveForSeconds', 'nowMilliseconds',
  'clockSample', 'connectorFailed', 'allowLabeledSnapshots'
];
const CLOCK_SAMPLE_KEYS = [
  'previousWallMilliseconds', 'currentWallMilliseconds',
  'previousMonotonicMilliseconds', 'currentMonotonicMilliseconds'
];

/**
 * Compute the freshness state of an observation.
 *
 * age <= fresh is `fresh`; fresh < age <= serve is `stale`; age > serve is
 * `expired` and omitted. Connector failure within serve is `unavailable` and
 * may be emitted only when the caller explicitly allows labeled snapshots.
 * Wall-clock regression beyond one second or monotonic/wall inconsistency
 * forces `unavailable`.
 */
export function evaluateFreshness(input) {
  const snapshot = snapshotInput(input, FRESHNESS_INPUT_KEYS, 'freshness input');
  const { freshForSeconds, serveForSeconds } = parseFreshnessPolicy(snapshot);
  const observed = canonicalTimestamp(snapshot.observedAt, 'observedAt');
  const nowMilliseconds = snapshot.nowMilliseconds;
  const connectorFailed = snapshot.connectorFailed;
  const allowLabeledSnapshots = snapshot.allowLabeledSnapshots;
  if (!Number.isFinite(nowMilliseconds) || !Number.isInteger(nowMilliseconds)) {
    fail('KSTACK_MEMORY_FRESHNESS_INPUT_INVALID', 'nowMilliseconds must be an integer');
  }
  if (typeof connectorFailed !== 'boolean') {
    fail('KSTACK_MEMORY_FRESHNESS_INPUT_INVALID', 'connectorFailed must be boolean');
  }
  if (typeof allowLabeledSnapshots !== 'boolean') {
    fail('KSTACK_MEMORY_FRESHNESS_INPUT_INVALID', 'allowLabeledSnapshots must be boolean');
  }

  let clockFault = null;
  const deltaMilliseconds = nowMilliseconds - observed.epochMilliseconds;
  if (deltaMilliseconds < -CLOCK_REGRESSION_TOLERANCE_MILLISECONDS) {
    clockFault = 'WALL_CLOCK_REGRESSION';
  }
  if (snapshot.clockSample !== null) {
    // Nested object, so it carries its own snapshot: the four readings that are
    // checked for finiteness must be the four that the deltas are computed from.
    const clockSample = snapshotInput(snapshot.clockSample, CLOCK_SAMPLE_KEYS, 'clock sample');
    for (const key of CLOCK_SAMPLE_KEYS) {
      if (!Number.isFinite(clockSample[key])) {
        fail('KSTACK_MEMORY_FRESHNESS_INPUT_INVALID', `clockSample.${key} must be finite`);
      }
    }
    const wallDelta = clockSample.currentWallMilliseconds - clockSample.previousWallMilliseconds;
    const monotonicDelta = clockSample.currentMonotonicMilliseconds - clockSample.previousMonotonicMilliseconds;
    if (monotonicDelta < 0) clockFault = clockFault ?? 'MONOTONIC_REGRESSION';
    if (wallDelta < -CLOCK_REGRESSION_TOLERANCE_MILLISECONDS) clockFault = clockFault ?? 'WALL_CLOCK_REGRESSION';
    if (Math.abs(wallDelta - monotonicDelta) > CLOCK_REGRESSION_TOLERANCE_MILLISECONDS) {
      clockFault = clockFault ?? 'MONOTONIC_WALL_INCONSISTENCY';
    }
  }

  const ageSeconds = Math.max(0, deltaMilliseconds) / 1000;
  const withinServe = ageSeconds <= serveForSeconds;

  if (clockFault !== null) {
    return Object.freeze({
      state: 'unavailable',
      emit: allowLabeledSnapshots && withinServe,
      ageSeconds,
      reasonCode: clockFault
    });
  }
  if (connectorFailed) {
    if (withinServe) {
      return Object.freeze({
        state: 'unavailable',
        emit: allowLabeledSnapshots,
        ageSeconds,
        reasonCode: 'CONNECTOR_FAILURE_WITHIN_SERVE'
      });
    }
    return Object.freeze({ state: 'expired', emit: false, ageSeconds, reasonCode: 'BEYOND_SERVE_WINDOW' });
  }
  if (ageSeconds <= freshForSeconds) {
    return Object.freeze({ state: 'fresh', emit: true, ageSeconds, reasonCode: 'WITHIN_FRESH_WINDOW' });
  }
  if (withinServe) {
    return Object.freeze({ state: 'stale', emit: true, ageSeconds, reasonCode: 'WITHIN_SERVE_WINDOW' });
  }
  return Object.freeze({ state: 'expired', emit: false, ageSeconds, reasonCode: 'BEYOND_SERVE_WINDOW' });
}

/* ------------------------------------------------------------------------- */
/* Capability contract                                                        */
/* ------------------------------------------------------------------------- */

export const CAPABILITY_ACTIONS = Object.freeze(['read', 'ingest', 'remote-sync', 'administrative-delete']);
export const MUTATING_ACTIONS = Object.freeze(['ingest', 'remote-sync', 'administrative-delete']);
export const MAXIMUM_CAPABILITY_LIFETIME_MILLISECONDS = 15 * 60 * 1000;

const CAPABILITY_STATE_KEYS = [
  'capabilityIdHash', 'subjectId', 'repoId', 'action', 'constraintsHash',
  'issuedAt', 'expiresAt', 'policyGeneration', 'revokedAt', 'parentGrantId', 'requestNonce'
];

export function parseCapabilityState(input) {
  const snapshot = snapshotInput(input, CAPABILITY_STATE_KEYS, 'capability state');
  if (!CAPABILITY_ACTIONS.includes(snapshot.action)) {
    fail('KSTACK_MEMORY_CAPABILITY_INVALID', 'action is not a recognized capability action');
  }
  const issuedAt = canonicalTimestamp(snapshot.issuedAt, 'issuedAt');
  const expiresAt = canonicalTimestamp(snapshot.expiresAt, 'expiresAt');
  if (expiresAt.epochMilliseconds <= issuedAt.epochMilliseconds) {
    fail('KSTACK_MEMORY_CAPABILITY_INVALID', 'expiresAt must follow issuedAt');
  }
  if (expiresAt.epochMilliseconds - issuedAt.epochMilliseconds > MAXIMUM_CAPABILITY_LIFETIME_MILLISECONDS) {
    fail('KSTACK_MEMORY_CAPABILITY_LIFETIME', 'capability lifetime exceeds 15 minutes');
  }
  return Object.freeze({
    capabilityIdHash: hexDigest32(snapshot.capabilityIdHash, 'capabilityIdHash'),
    subjectId: canonicalText(snapshot.subjectId, LIMITS.text, 'subjectId').text,
    repoId: assertRepoId(snapshot.repoId, 'repoId'),
    action: snapshot.action,
    constraintsHash: hexDigest32(snapshot.constraintsHash, 'constraintsHash'),
    issuedAt: issuedAt.text,
    expiresAt: expiresAt.text,
    policyGeneration: Number(unsignedInteger(snapshot.policyGeneration, 'policyGeneration')),
    revokedAt: snapshot.revokedAt === null ? null : canonicalTimestamp(snapshot.revokedAt, 'revokedAt').text,
    parentGrantId: snapshot.parentGrantId === null ? null : canonicalText(snapshot.parentGrantId, LIMITS.text, 'parentGrantId').text,
    requestNonce: snapshot.requestNonce === null ? null : hexDigest32(snapshot.requestNonce, 'requestNonce')
  });
}

const GRANT_KEYS = [
  'grantId', 'fromRepoId', 'toRepoId', 'actions', 'artifactClasses',
  'pathOrProjectScope', 'purpose', 'approvedBy', 'approvedAt', 'expiresAt',
  'policyGeneration', 'revokedAt'
];

export function parseCrossRepositoryGrant(input) {
  const snapshot = snapshotInput(input, GRANT_KEYS, 'cross-repository grant');
  // The action list decides what this grant can actually authorize, so the
  // list that is validated below and the list that is stored must be the same
  // one. No action capability substitutes for another.
  const actions = snapshot.actions;
  if (!Array.isArray(actions) || actions.length === 0 || actions.length > CAPABILITY_ACTIONS.length) {
    fail('KSTACK_MEMORY_GRANT_INVALID', 'actions must be a non-empty bounded list');
  }
  for (const action of actions) {
    if (!CAPABILITY_ACTIONS.includes(action)) fail('KSTACK_MEMORY_GRANT_INVALID', 'actions contains an unknown action');
  }
  if (new Set(actions).size !== actions.length) {
    fail('KSTACK_MEMORY_GRANT_INVALID', 'actions must not repeat');
  }
  const artifactClasses = snapshot.artifactClasses;
  if (!Array.isArray(artifactClasses) || artifactClasses.length === 0 || artifactClasses.length > LIMITS.listElements) {
    fail('KSTACK_MEMORY_GRANT_INVALID', 'artifactClasses must be a non-empty bounded list');
  }
  for (const artifactClass of artifactClasses) {
    if (artifactClass === '*') continue;
    lowerAsciiIdentifier(artifactClass, LIMITS.artifactClass, 'artifactClasses entry');
  }
  const pathOrProjectScope = snapshot.pathOrProjectScope;
  if (!Array.isArray(pathOrProjectScope) || pathOrProjectScope.length === 0 || pathOrProjectScope.length > LIMITS.listElements) {
    fail('KSTACK_MEMORY_GRANT_INVALID', 'pathOrProjectScope must be a non-empty bounded list');
  }
  for (const scope of pathOrProjectScope) {
    if (scope === '*') continue;
    // Grant scopes are compared against raw authority path bytes and are
    // therefore never Unicode-normalized.
    rawScopeText(scope, LIMITS.authorityPath, 'pathOrProjectScope entry');
  }
  const fromRepoId = assertRepoId(snapshot.fromRepoId, 'fromRepoId');
  const toRepoId = assertRepoId(snapshot.toRepoId, 'toRepoId');
  if (fromRepoId === toRepoId) fail('KSTACK_MEMORY_GRANT_INVALID', 'a grant must cross two distinct repositories');
  const approvedAt = canonicalTimestamp(snapshot.approvedAt, 'approvedAt');
  const expiresAt = canonicalTimestamp(snapshot.expiresAt, 'expiresAt');
  if (expiresAt.epochMilliseconds <= approvedAt.epochMilliseconds) {
    fail('KSTACK_MEMORY_GRANT_INVALID', 'a grant must be time bounded');
  }
  return Object.freeze({
    grantId: canonicalText(snapshot.grantId, LIMITS.text, 'grantId').text,
    fromRepoId,
    toRepoId,
    actions: Object.freeze([...actions]),
    artifactClasses: Object.freeze([...artifactClasses]),
    pathOrProjectScope: Object.freeze([...pathOrProjectScope]),
    purpose: canonicalText(snapshot.purpose, LIMITS.text, 'purpose').text,
    approvedBy: canonicalText(snapshot.approvedBy, LIMITS.text, 'approvedBy').text,
    approvedAt: approvedAt.text,
    expiresAt: expiresAt.text,
    policyGeneration: Number(unsignedInteger(snapshot.policyGeneration, 'policyGeneration')),
    revokedAt: snapshot.revokedAt === null ? null : canonicalTimestamp(snapshot.revokedAt, 'revokedAt').text
  });
}

/* ------------------------------------------------------------------------- */
/* Canonical constraints                                                      */
/* ------------------------------------------------------------------------- */

const CONSTRAINT_KEYS = ['providers', 'projectIds', 'fieldIds', 'pathPrefixes', 'retentionClasses'];

/**
 * Constraints are a closed, order-insensitive set of allowlists. `null` means
 * the dimension is unconstrained; an empty list denies everything.
 */
export function canonicalConstraints(input) {
  const snapshot = snapshotInput(input, CONSTRAINT_KEYS, 'constraints');
  const canonical = {};
  for (const key of CONSTRAINT_KEYS) {
    const value = snapshot[key];
    if (value === null) {
      canonical[key] = null;
      continue;
    }
    if (!Array.isArray(value) || value.length > LIMITS.listElements) {
      fail('KSTACK_MEMORY_CONSTRAINTS_INVALID', `${key} must be null or a bounded list`);
    }
    // No constraint entry is ever NFKC normalized. Each is compared against a
    // value that is itself never normalized — raw authority path bytes, a
    // provider-issued identifier, or a lower-ASCII class — so normalizing one
    // side only would let a lookalike entry match a value it does not equal.
    const normalized = value.map((entry) => rawScopeText(
      entry,
      key === 'pathPrefixes' ? LIMITS.authorityPath : LIMITS.text,
      `${key} entry`
    ));
    if (new Set(normalized).size !== normalized.length) {
      fail('KSTACK_MEMORY_CONSTRAINTS_INVALID', `${key} must not repeat`);
    }
    // Ordered by UTF-8 bytes so the hash is stable across hosts.
    canonical[key] = [...normalized].sort((left, right) => Buffer.compare(
      Buffer.from(left, 'utf8'),
      Buffer.from(right, 'utf8')
    ));
  }
  return canonical;
}

/** Deterministic bytes for the canonical constraint set, hashed for binding. */
export function encodeConstraints(input) {
  const canonical = canonicalConstraints(input);
  const fields = CONSTRAINT_KEYS.map((key, index) => {
    const value = canonical[key];
    if (value === null) return { id: index + 1, kind: 'null', value: null };
    const chunks = [];
    const count = Buffer.alloc(4);
    count.writeUInt32BE(value.length, 0);
    chunks.push(count);
    for (const entry of value) {
      const entryBytes = Buffer.from(entry, 'utf8');
      const length = Buffer.alloc(4);
      length.writeUInt32BE(entryBytes.length, 0);
      chunks.push(length, entryBytes);
    }
    return { id: index + 1, kind: 'raw', value: Buffer.concat(chunks) };
  });
  return encodeContainer({ magic: KSB1_MAGIC, schema: 1, fields });
}

export function constraintsHash(input) {
  return sha256Hex(encodeConstraints(input));
}

const CANDIDATE_KEYS = ['provider', 'projectId', 'fieldIds', 'pathBytes', 'retentionClass'];

/**
 * Every constrained dimension must be satisfied; unresolvable values deny.
 *
 * `candidate.pathBytes` must be the raw authority path bytes taken from the
 * record's own locator, never a caller-asserted string.
 */
export function constraintsSatisfied(constraints, candidate) {
  const canonical = canonicalConstraints(constraints);
  const snapshot = snapshotInput(candidate, CANDIDATE_KEYS, 'candidate');
  const checks = [
    ['providers', snapshot.provider],
    ['projectIds', snapshot.projectId],
    ['retentionClasses', snapshot.retentionClass]
  ];
  for (const [key, value] of checks) {
    const allowed = canonical[key];
    if (allowed === null) continue;
    if (typeof value !== 'string' || value.length === 0) {
      return { satisfied: false, reasonCode: `CONSTRAINT_UNRESOLVABLE_${key.toUpperCase()}` };
    }
    if (!allowed.includes(value)) {
      return { satisfied: false, reasonCode: `CONSTRAINT_DENIED_${key.toUpperCase()}` };
    }
  }
  if (canonical.pathPrefixes !== null) {
    const pathBytes = snapshot.pathBytes;
    if (!Buffer.isBuffer(pathBytes) || pathBytes.length === 0) {
      return { satisfied: false, reasonCode: 'CONSTRAINT_UNRESOLVABLE_PATHPREFIXES' };
    }
    if (!canonical.pathPrefixes.some((prefix) => scopeBytesMatch(prefix, pathBytes))) {
      return { satisfied: false, reasonCode: 'CONSTRAINT_DENIED_PATHPREFIXES' };
    }
  }
  if (canonical.fieldIds !== null) {
    const fieldIds = snapshot.fieldIds;
    if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
      return { satisfied: false, reasonCode: 'CONSTRAINT_UNRESOLVABLE_FIELDIDS' };
    }
    for (const fieldId of fieldIds) {
      if (typeof fieldId !== 'string' || !canonical.fieldIds.includes(fieldId)) {
        return { satisfied: false, reasonCode: 'CONSTRAINT_DENIED_FIELDIDS' };
      }
    }
  }
  return { satisfied: true, reasonCode: 'CONSTRAINTS_SATISFIED' };
}

/* ------------------------------------------------------------------------- */
/* Authorization                                                              */
/* ------------------------------------------------------------------------- */

const AUTHORIZATION_REQUEST_KEYS = ['subjectId', 'repoId', 'action', 'constraints', 'requestNonce'];

/**
 * Parse a request into a frozen validated value.
 *
 * Every field is read exactly once, into a local, before it is checked. An
 * accessor-backed input must not be able to return one value to the check and
 * another to the result.
 */
export function parseAuthorizationRequest(input) {
  const snapshot = snapshotInput(input, AUTHORIZATION_REQUEST_KEYS, 'authorization request');
  const action = snapshot.action;
  if (!CAPABILITY_ACTIONS.includes(action)) {
    fail('KSTACK_MEMORY_REQUEST_INVALID', 'action is not a recognized capability action');
  }
  const requestNonce = snapshot.requestNonce;
  return Object.freeze({
    subjectId: canonicalText(snapshot.subjectId, LIMITS.text, 'subjectId').text,
    repoId: assertRepoId(snapshot.repoId, 'repoId'),
    action,
    constraints: canonicalConstraints(snapshot.constraints),
    requestNonce: requestNonce === null ? null : hexDigest32(requestNonce, 'requestNonce')
  });
}

/** `Set.prototype.has`, captured before any caller can shadow it. */
const SET_HAS = Set.prototype.has;
const ARRAY_INCLUDES = Array.prototype.includes;

/**
 * Ask a replay ledger whether a nonce was already consumed, without ever
 * dispatching through anything the caller controls.
 *
 * Returns `true`/`false`, or `null` when the ledger is not a shape this module
 * will trust — the caller's cue to fail closed.
 *
 * The previous form of this check was exploitable three ways: `instanceof Set`
 * consults a prototype chain a Proxy can answer differently on each read;
 * `new Set(value)` consults the caller's `@@iterator`; and `value.has(...)`
 * dispatches to an own `has` that an `Object.create(Set.prototype)` lookalike
 * can supply. Each turned a replay into an authorization.
 *
 * So a real Set is identified by BORROWING `Set.prototype.has` and calling it
 * on the value: that method requires the internal `[[SetData]]` slot and throws
 * for anything without it, which is a genuine brand check rather than a
 * prototype-chain guess. The same borrowed method then performs the lookup, so
 * an own `has` is never reached. An array ledger is accepted too, but only
 * after `inertCopy` has rebuilt it index by index.
 */
function nonceLedgerContains(ledger, nonce) {
  if (ledger === null || typeof ledger !== 'object') return null;
  try {
    // Throws unless `ledger` genuinely carries [[SetData]].
    return SET_HAS.call(ledger, nonce) === true;
  } catch {
    // Not a real Set; fall through to the array form.
  }
  if (!Array.isArray(ledger)) return null;
  let copied;
  try {
    copied = inertCopy(ledger, 'consumedNonces');
  } catch {
    // The documented contract is true/false/null; a ledger this module cannot
    // copy is unresolvable, not an exception thrown through `authorizeCapability`.
    return null;
  }
  for (let index = 0; index < copied.length; index += 1) {
    if (copied[index] === nonce) return true;
  }
  return false;
}

function deny(reasonCode) {
  return Object.freeze({ allowed: false, reasonCode });
}

function permit(reasonCode, extra = {}) {
  return Object.freeze({ allowed: true, reasonCode, ...extra });
}

const AUTHORIZATION_INPUT_KEYS = [
  'request', 'capability', 'currentPolicyGeneration', 'nowMilliseconds',
  'consumedNonces', 'grants', 'authenticatedSubjectId'
];

/**
 * Authorization is the intersection of authenticated subject, exact
 * request/token repoId, action equality, constraint binding, current policy
 * generation, live grant lineage, expiry, and unique nonce for mutation.
 * Missing, ambiguous, stale, duplicated, or unresolvable inputs deny.
 */
export function authorizeCapability(input) {
  // Unwrapped, exactly as the bare `exactKeys` call it replaces was: a
  // malformed top-level shape still throws rather than denying. Snapshotting
  // adds only a copy, which cannot fail on its own.
  // `consumedNonces` is the caller's live replay ledger and is declared opaque
  // so it survives by reference — inert-copying a Set would flatten it to an
  // empty object and silently disable replay detection. Being opaque is NOT a
  // grant of trust: `nonceLedgerContains` brand-checks it with a borrowed
  // `Set.prototype.has` and never dispatches through it.
  const snapshot = snapshotInput(input, AUTHORIZATION_INPUT_KEYS, 'authorization input', ['consumedNonces']);
  const authenticatedSubjectId = snapshot.authenticatedSubjectId;
  const currentPolicyGeneration = snapshot.currentPolicyGeneration;
  const nowMilliseconds = snapshot.nowMilliseconds;
  const consumedNonces = snapshot.consumedNonces;
  let request;
  let capability;
  try {
    request = parseAuthorizationRequest(snapshot.request);
    capability = parseCapabilityState(snapshot.capability);
  } catch (error) {
    return deny(error instanceof MemoryAuthorityError ? error.code : 'KSTACK_MEMORY_REQUEST_INVALID');
  }
  if (typeof authenticatedSubjectId !== 'string' || authenticatedSubjectId.length === 0) {
    return deny('SUBJECT_UNAUTHENTICATED');
  }
  if (authenticatedSubjectId !== request.subjectId) return deny('SUBJECT_MISMATCH');
  if (capability.subjectId !== request.subjectId) return deny('SUBJECT_MISMATCH');
  if (capability.repoId !== request.repoId) return deny('REPOSITORY_MISMATCH');
  if (capability.action !== request.action) return deny('ACTION_MISMATCH');
  if (capability.constraintsHash !== constraintsHash(request.constraints)) return deny('CONSTRAINTS_MISMATCH');
  if (!Number.isInteger(currentPolicyGeneration) || currentPolicyGeneration < 0) {
    return deny('POLICY_GENERATION_UNRESOLVABLE');
  }
  if (capability.policyGeneration !== currentPolicyGeneration) return deny('POLICY_GENERATION_STALE');
  if (capability.revokedAt !== null) return deny('CAPABILITY_REVOKED');
  if (!Number.isInteger(nowMilliseconds)) return deny('CLOCK_UNRESOLVABLE');
  const issuedAt = Date.parse(capability.issuedAt);
  const expiresAt = Date.parse(capability.expiresAt);
  if (nowMilliseconds < issuedAt) return deny('CAPABILITY_NOT_YET_VALID');
  if (nowMilliseconds >= expiresAt) return deny('CAPABILITY_EXPIRED');

  const requiresNonce = MUTATING_ACTIONS.includes(request.action);
  if (requiresNonce) {
    if (request.requestNonce === null || capability.requestNonce === null) return deny('NONCE_MISSING');
    if (request.requestNonce !== capability.requestNonce) return deny('NONCE_MISMATCH');
    const replayed = nonceLedgerContains(consumedNonces, request.requestNonce);
    if (replayed === null) return deny('NONCE_STATE_UNRESOLVABLE');
    if (replayed) return deny('NONCE_REPLAYED');
  }

  if (capability.parentGrantId !== null) {
    let grants;
    try {
      grants = parseGrantSet(snapshot.grants);
    } catch (error) {
      return deny(error instanceof MemoryAuthorityError ? error.code : 'KSTACK_MEMORY_GRANT_INVALID');
    }
    const grant = grants.get(capability.parentGrantId);
    if (!grant) return deny('GRANT_LINEAGE_UNRESOLVABLE');
    const lineage = evaluateGrant({
      grant,
      requestRepoId: request.repoId,
      action: request.action,
      currentPolicyGeneration,
      nowMilliseconds
    });
    if (!lineage.allowed) return lineage;
  }

  return permit('AUTHORIZED', { capabilityIdHash: capability.capabilityIdHash, action: request.action });
}

export function parseGrantSet(grants) {
  if (!Array.isArray(grants)) fail('KSTACK_MEMORY_GRANT_INVALID', 'grants must be a list');
  // The CONTAINER crosses the boundary, not just its elements. Checking
  // `grants.length` and then iterating with `for...of` bounded nothing: the
  // caller's own `@@iterator` decides what the loop actually yields, so a list
  // reporting `length: 0` could still deliver thousands of grants.
  const copied = inertCopy(grants, 'grants');
  if (copied.length > LIMITS.listElements) fail('KSTACK_MEMORY_GRANT_INVALID', 'grants exceed the list bound');
  const byId = new Map();
  for (let index = 0; index < copied.length; index += 1) {
    const grant = parseCrossRepositoryGrant(copied[index]);
    if (byId.has(grant.grantId)) fail('KSTACK_MEMORY_GRANT_DUPLICATE', 'grantId is duplicated');
    byId.set(grant.grantId, grant);
  }
  return byId;
}

/**
 * Liveness of one grant against the current generation, clock, and action.
 * Exported so a query stage can narrow to live grants instead of widening on
 * revoked, expired, or stale-generation ones.
 */
export function evaluateGrant({ grant, requestRepoId, action, currentPolicyGeneration, nowMilliseconds }) {
  if (grant.revokedAt !== null) return deny('GRANT_REVOKED');
  if (grant.policyGeneration !== currentPolicyGeneration) return deny('GRANT_POLICY_GENERATION_STALE');
  if (grant.toRepoId !== requestRepoId) return deny('GRANT_TARGET_MISMATCH');
  // Borrowed method: `grant` is normally this module's own validated value,
  // but this function is exported, and an own `includes` returning `true`
  // would otherwise hand out any action.
  if (!ARRAY_INCLUDES.call(grant.actions, action)) return deny('GRANT_ACTION_MISMATCH');
  const approvedAt = Date.parse(grant.approvedAt);
  const expiresAt = Date.parse(grant.expiresAt);
  if (nowMilliseconds < approvedAt) return deny('GRANT_NOT_YET_VALID');
  if (nowMilliseconds >= expiresAt) return deny('GRANT_EXPIRED');
  return permit('GRANT_LIVE', { grantId: grant.grantId });
}

const RECORD_ACCESS_KEYS = [
  'requestRepoId', 'record', 'action', 'assertedScope', 'grants',
  'currentPolicyGeneration', 'nowMilliseconds'
];

/**
 * Record-level access. Default results require record repoId equal to request
 * repoId. Cross-repository access needs one direct, live, owner-approved grant
 * that matches exactly; grants never chain and never wildcard restricted data.
 */
export function authorizeRecordAccess(input) {
  // Unwrapped, matching the bare `exactKeys` call it replaces: a malformed
  // top-level shape throws rather than denying.
  const snapshot = snapshotInput(input, RECORD_ACCESS_KEYS, 'record access input');
  const assertedScope = snapshot.assertedScope;
  const action = snapshot.action;
  const currentPolicyGeneration = snapshot.currentPolicyGeneration;
  const nowMilliseconds = snapshot.nowMilliseconds;
  let record;
  let scope;
  try {
    // Only a record this module's own parser produced may skip revalidation.
    // `Object.freeze` is forgeable by any caller and is never accepted here.
    //
    // The candidate comes from the snapshot, so it is always an `inertCopy`
    // product and never one of the objects held in VALIDATED_SOURCE_RECORDS.
    // The marker check below is therefore always false in practice and the
    // record is always re-parsed. That is intentional and safe — re-parsing
    // revalidates — and the check is kept only so the invariant stays stated at
    // the point it matters: an object that has not been validated by this
    // module is never trusted, whatever the caller asserts about it.
    const candidate = snapshot.record;
    record = VALIDATED_SOURCE_RECORDS.has(candidate) ? candidate : parseSourceRecordV1(candidate);
    scope = deriveRecordScope(record);
  } catch (error) {
    return deny(error instanceof MemoryAuthorityError ? error.code : 'KSTACK_MEMORY_RECORD_INVALID');
  }
  if (!CAPABILITY_ACTIONS.includes(action)) return deny('ACTION_UNRECOGNIZED');
  let requestRepoId;
  try {
    requestRepoId = assertRepoId(snapshot.requestRepoId, 'requestRepoId');
  } catch {
    return deny('REPOSITORY_UNRESOLVABLE');
  }
  if (record.status !== 'active') return deny('RECORD_NOT_ACTIVE');
  // A caller may assert the scope it believes it is reading, but the assertion
  // is only ever checked for consistency with the record's real locator; the
  // scope used for grant matching always comes from the record itself.
  // Accepted as raw bytes or as a string: an authority path is raw and need
  // not be valid UTF-8, so a byte-exact assertion must always be expressible.
  if (assertedScope !== null) {
    let asserted = null;
    if (ArrayBuffer.isView(assertedScope)) asserted = copyViewBytes(assertedScope, 'assertedScope');
    else if (typeof assertedScope === 'string') asserted = Buffer.from(assertedScope, 'utf8');
    if (asserted === null || !asserted.equals(scope.bytes)) {
      return deny('ASSERTED_SCOPE_INCONSISTENT_WITH_RECORD');
    }
  }

  if (record.repoId === requestRepoId) {
    return permit('SAME_REPOSITORY', { grantId: null });
  }

  let grants;
  try {
    grants = parseGrantSet(snapshot.grants);
  } catch (error) {
    return deny(error instanceof MemoryAuthorityError ? error.code : 'KSTACK_MEMORY_GRANT_INVALID');
  }
  const matches = [];
  for (const grant of grants.values()) {
    if (grant.fromRepoId !== record.repoId) continue;
    if (grant.toRepoId !== requestRepoId) continue;
    matches.push(grant);
  }
  if (matches.length === 0) return deny('CROSS_REPOSITORY_DENIED_NO_GRANT');
  if (matches.length > 1) return deny('CROSS_REPOSITORY_GRANT_AMBIGUOUS');
  const grant = matches[0];
  const lineage = evaluateGrant({
    grant,
    requestRepoId,
    action,
    currentPolicyGeneration,
    nowMilliseconds
  });
  if (!lineage.allowed) return lineage;

  const restricted = RESTRICTED_SENSITIVITY_CLASSES.includes(record.sensitivityClass);
  if (restricted && (grant.artifactClasses.includes('*') || grant.pathOrProjectScope.includes('*'))) {
    return deny('GRANT_WILDCARD_FORBIDDEN_FOR_RESTRICTED_DATA');
  }
  if (!grant.artifactClasses.includes('*') && !grant.artifactClasses.includes(record.artifactClass)) {
    return deny('GRANT_ARTIFACT_CLASS_MISMATCH');
  }
  const scopeMatched = grant.pathOrProjectScope.includes('*')
    || grant.pathOrProjectScope.some((entry) => entry !== '*'
      && scopeBytesMatch(entry, scope.bytes, scope.exactOnly));
  if (!scopeMatched) return deny('GRANT_SCOPE_MISMATCH');
  return permit('CROSS_REPOSITORY_GRANTED', { grantId: grant.grantId });
}

/**
 * Grants are non-transitive: reaching `record.repoId` only through a chain of
 * grants is never sufficient. This helper makes that explicit for callers that
 * want to assert the property directly.
 */
export function grantChainIsTransitive(grants, fromRepoId, toRepoId) {
  const parsed = parseGrantSet(grants);
  const direct = [...parsed.values()].some((grant) => grant.fromRepoId === fromRepoId && grant.toRepoId === toRepoId);
  if (direct) return false;
  const reachable = new Set([fromRepoId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const grant of parsed.values()) {
      if (reachable.has(grant.fromRepoId) && !reachable.has(grant.toRepoId)) {
        reachable.add(grant.toRepoId);
        grew = true;
      }
    }
  }
  return reachable.has(toRepoId);
}
