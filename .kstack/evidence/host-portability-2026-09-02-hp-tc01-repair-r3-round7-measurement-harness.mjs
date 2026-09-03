// Instrumentation harness: verbatim copies of the internal pattern-engine
// functions from plugins/kstack/scripts/kstack-host-contract.mjs (lines
// 1666-1845 as read 2026-09-02), extended only to RETURN internal counters
// (dfaStateCount, symbolCount, sum-of-members-length) that the production
// code does not expose. Measurement-only; does not modify the production file.

class FailError extends Error { constructor(code) { super(code); this.code = code; } }
function fail(code) { throw new FailError(code); }

const PATTERN_TOKEN = /(?:\[[^\]\\]+\]|[A-Za-z0-9_:.-])(?:\{([0-9]+)(?:,([0-9]+))?\}|[+*?])?/uy;
const MAX_PATTERN_DFA_STATES = 4096; // HOST_CONTRACT_LIMITS.maxPatternDfaStates, confirmed at kstack-host-contract.mjs:18

function closedPatternClassMembers(content) {
  if (content.startsWith('^')) fail('KSTACK_HOST_PATTERN_INVALID');
  const members = new Set();
  let index = 0;
  while (index < content.length) {
    const first = content.charCodeAt(index);
    if (content[index + 1] === '-' && index + 2 < content.length) {
      const last = content.charCodeAt(index + 2);
      if (first > last) fail('KSTACK_HOST_PATTERN_INVALID');
      for (let code = first; code <= last; code += 1) members.add(code);
      index += 3;
    } else { members.add(first); index += 1; }
  }
  return members;
}

function parseClosedPatternAtoms(body) {
  const atoms = [];
  let offset = 0;
  let nfaSizeGuard = 1;
  while (offset < body.length) {
    PATTERN_TOKEN.lastIndex = offset;
    const match = PATTERN_TOKEN.exec(body);
    if (!match || match.index !== offset) fail('KSTACK_HOST_PATTERN_INVALID');
    const text = match[0];
    const atomEnd = text[0] === '[' ? text.indexOf(']') + 1 : 1;
    const atomText = text.slice(0, atomEnd);
    const quantifier = text.slice(atomEnd);
    const members = atomText[0] === '[' ? closedPatternClassMembers(atomText.slice(1, -1)) : new Set([atomText.charCodeAt(0)]);
    let min = 1, max = 1;
    if (quantifier === '?') { min = 0; max = 1; }
    else if (quantifier === '*') { min = 0; max = Number.POSITIVE_INFINITY; }
    else if (quantifier === '+') { min = 1; max = Number.POSITIVE_INFINITY; }
    else if (quantifier !== '') {
      min = Number(match[1]); max = match[2] === undefined ? min : Number(match[2]);
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || min > max) fail('KSTACK_HOST_PATTERN_INVALID');
    }
    nfaSizeGuard += max === Number.POSITIVE_INFINITY ? 2 : max;
    if (nfaSizeGuard > MAX_PATTERN_DFA_STATES) fail('KSTACK_HOST_PATTERN_NFA_SIZE_LIMIT');
    atoms.push({ members, min, max });
    offset = PATTERN_TOKEN.lastIndex;
  }
  return { atoms, nfaSizeGuard };
}

function buildClosedPatternNfa(atoms) {
  const states = [];
  const newState = () => { states.push({ eps: [], members: null, next: -1 }); return states.length - 1; };
  const occurrence = (members) => { const from = newState(); const to = newState(); states[from].members = members; states[from].next = to; return { in: from, out: to }; };
  const start = newState();
  let cursor = start;
  for (const atom of atoms) {
    for (let index = 0; index < atom.min; index += 1) { const fragment = occurrence(atom.members); states[cursor].eps.push(fragment.in); cursor = fragment.out; }
    if (atom.max === Number.POSITIVE_INFINITY) {
      const loop = newState(); states[cursor].eps.push(loop);
      const fragment = occurrence(atom.members); states[loop].eps.push(fragment.in); states[fragment.out].eps.push(loop);
      cursor = loop;
    } else if (atom.max > atom.min) {
      const exit = newState();
      for (let index = atom.min; index < atom.max; index += 1) { states[cursor].eps.push(exit); const fragment = occurrence(atom.members); states[cursor].eps.push(fragment.in); cursor = fragment.out; }
      states[cursor].eps.push(exit); cursor = exit;
    }
  }
  return { states, start, accept: cursor };
}

function closedPatternAlphabet(atoms) {
  const sets = [...new Set(atoms.map((atom) => atom.members))];
  const symbolOf = new Int32Array(128);
  const identifiers = new Map();
  let symbolCount = 1;
  for (let code = 0; code < 128; code += 1) {
    let signature = '';
    for (let index = 0; index < sets.length; index += 1) if (sets[index].has(code)) signature += `${index},`;
    if (signature === '') continue;
    let symbol = identifiers.get(signature);
    if (symbol === undefined) { symbol = symbolCount; symbolCount += 1; identifiers.set(signature, symbol); }
    symbolOf[code] = symbol;
  }
  const admits = new Map();
  for (const set of sets) { const mask = new Uint8Array(symbolCount); for (let code = 0; code < 128; code += 1) if (set.has(code)) mask[symbolOf[code]] = 1; admits.set(set, mask); }
  return { symbolOf, symbolCount, admits };
}

function determinizeClosedPattern(nfa, alphabet) {
  const { states, start, accept } = nfa;
  const { symbolCount, admits } = alphabet;
  const words = (states.length + 31) >>> 5;
  const admitted = states.map((state) => (state.members === null ? null : admits.get(state.members)));
  const marks = new Int32Array(states.length);
  let generation = 0;
  const closure = (seeds) => {
    generation += 1; const stack = []; const bits = new Uint32Array(words);
    for (const seed of seeds) if (marks[seed] !== generation) { marks[seed] = generation; stack.push(seed); }
    while (stack.length) { const current = stack.pop(); bits[current >>> 5] |= 1 << (current & 31); for (const target of states[current].eps) if (marks[target] !== generation) { marks[target] = generation; stack.push(target); } }
    return bits;
  };
  const identifiers = new Map(); const subsets = []; const accepting = []; const transitions = [];
  const intern = (bits) => {
    const key = Buffer.from(bits.buffer, bits.byteOffset, bits.byteLength).toString('latin1');
    const existing = identifiers.get(key); if (existing !== undefined) return existing;
    if (identifiers.size >= MAX_PATTERN_DFA_STATES) fail('KSTACK_HOST_PATTERN_DFA_LIMIT');
    const identifier = identifiers.size; identifiers.set(key, identifier); subsets.push(bits);
    accepting.push(((bits[accept >>> 5] >>> (accept & 31)) & 1) === 1);
    transitions.push(new Int32Array(symbolCount).fill(-1));
    return identifier;
  };
  intern(closure([start]));
  const members = [];
  let sumMembersLength = 0;
  let maxMembersLength = 0;
  let symbolMemberProduct = 0; // sum over all (state, symbol-loop-iteration) of members.length -- the exact double-loop cost driver at line 1837-1839
  for (let identifier = 0; identifier < subsets.length; identifier += 1) {
    const bits = subsets[identifier];
    members.length = 0;
    for (let word = 0; word < words; word += 1) {
      let remaining = bits[word];
      while (remaining !== 0) { const lowest = remaining & -remaining; const source = (word << 5) + (31 - Math.clz32(lowest)); if (admitted[source] !== null) members.push(source); remaining ^= lowest; }
    }
    sumMembersLength += members.length;
    if (members.length > maxMembersLength) maxMembersLength = members.length;
    symbolMemberProduct += (symbolCount - 1) * members.length;
    for (let symbol = 1; symbol < symbolCount; symbol += 1) {
      const moved = [];
      for (const source of members) if (admitted[source][symbol] === 1) moved.push(states[source].next);
      if (moved.length === 0) continue;
      transitions[identifier][symbol] = intern(closure(moved));
    }
  }
  return { accepting, transitions, dfaStateCount: identifiers.size, sumMembersLength, maxMembersLength, symbolMemberProduct };
}

export function inspectPattern(pattern) {
  const body = pattern.slice(1, -1);
  const { atoms, nfaSizeGuard } = parseClosedPatternAtoms(body);
  const alphabet = closedPatternAlphabet(atoms);
  const nfa = buildClosedPatternNfa(atoms);
  const det = determinizeClosedPattern(nfa, alphabet);
  return {
    pattern,
    bytes: Buffer.byteLength(pattern, 'ascii'),
    nfaSizeGuard,
    nfaNodeCount: nfa.states.length,
    symbolCount: alphabet.symbolCount,
    dfaStateCount: det.dfaStateCount,
    sumMembersLength: det.sumMembersLength,
    maxMembersLength: det.maxMembersLength,
    symbolMemberProduct: det.symbolMemberProduct
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const patterns = process.argv.slice(2);
  for (const p of patterns) {
    try { console.log(JSON.stringify(inspectPattern(p))); }
    catch (err) { console.log(JSON.stringify({ pattern: p, error: err.code ?? err.message })); }
  }
}
