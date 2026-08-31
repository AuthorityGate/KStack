import crypto from 'node:crypto';
import { normalizeMatchValue } from '../reflexion/normalization.mjs';

export const UNICODE_ORACLE_SOURCES = Object.freeze({
  '16.0': Object.freeze([
    Object.freeze({ url: 'https://www.unicode.org/Public/16.0.0/ucd/UnicodeData.txt', sha256: 'ff58e5823bd095166564a006e47d111130813dcf8bf234ef79fa51a870edb48f' }),
    Object.freeze({ url: 'https://www.unicode.org/Public/16.0.0/ucd/SpecialCasing.txt', sha256: '8d5de354eef79f2395a54c9c7dcebbaf3d30fc962d0f85611ea97aa973a0c451' }),
    Object.freeze({ url: 'https://www.unicode.org/Public/16.0.0/ucd/DerivedNormalizationProps.txt', sha256: '4d4c03892dea9146d674b686e495df2d55a28d071ac474041d73518f887abddc' })
  ]),
  '17.0': Object.freeze([
    Object.freeze({ url: 'https://www.unicode.org/Public/17.0.0/ucd/UnicodeData.txt', sha256: '2e1efc1dcb59c575eedf5ccae60f95229f706ee6d031835247d843c11d96470c' }),
    Object.freeze({ url: 'https://www.unicode.org/Public/17.0.0/ucd/SpecialCasing.txt', sha256: 'efc25faf19de21b92c1194c111c932e03d2a5eaf18194e33f1156e96de4c9588' }),
    Object.freeze({ url: 'https://www.unicode.org/Public/17.0.0/ucd/DerivedNormalizationProps.txt', sha256: '71fd6a206a2c0cdd41feb6b7f656aa31091db45e9cedc926985d718397f9e488' })
  ])
});

function scalars(value) { return [...value]; }
function inputBytes(value) { return Buffer.byteLength(value, 'utf8'); }
function output(value) { return value.normalize('NFKC').toLowerCase(); }
const CASED = /\p{Cased}/u;
const CASE_IGNORABLE = /\p{Case_Ignorable}/u;
const STRUCTURAL_ASCII = new Set([...'<KSTACK_REFLEXION_LESSONS_V1></KSTACK_REFLEXION_LESSONS_V1>\t\n\r ",-/@:[\\]{}']);

function observe(sequence, maximum) {
  const transformed = output(sequence);
  const before = inputBytes(sequence);
  const after = inputBytes(transformed);
  if (after * maximum.inputBytes > maximum.outputBytes * before
      || (after * maximum.inputBytes === maximum.outputBytes * before && sequence.codePointAt(0) < maximum.firstCodePoint)) {
    return { inputBytes: before, outputBytes: after, outputScalars: scalars(transformed).length, firstCodePoint: sequence.codePointAt(0) };
  }
  return maximum;
}

export function runUnicodeOracle() {
  const sources = UNICODE_ORACLE_SOURCES[process.versions.unicode];
  if (!sources) throw new Error('KSTACK_REFLEXION_UNICODE_ORACLE_VERSION');
  let maximum = { inputBytes: 1, outputBytes: 1, outputScalars: 1, firstCodePoint: 0 };
  let scalarCount = 0;
  const primaryCompositionPairs = new Set();
  let structuralCompositionCount = 0;
  let conditionalContextCount = 0;
  let scalarMaximum = { inputBytes: 1, outputBytes: 1 };
  let scalarMaximumCount = 0;
  for (let codePoint = 0; codePoint <= 0x10ffff; codePoint += 1) {
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) continue;
    const scalar = String.fromCodePoint(codePoint);
    scalarCount += 1;
    maximum = observe(scalar, maximum);
    const scalarOutputBytes = inputBytes(output(scalar));
    const comparison = scalarOutputBytes * scalarMaximum.inputBytes - scalarMaximum.outputBytes * inputBytes(scalar);
    if (comparison > 0) { scalarMaximum = { inputBytes: inputBytes(scalar), outputBytes: scalarOutputBytes }; scalarMaximumCount = 1; }
    else if (comparison === 0) scalarMaximumCount += 1;
    if (inputBytes(normalizeMatchValue(scalar)) > scalarOutputBytes) throw new Error('KSTACK_REFLEXION_UNICODE_ORACLE_TOKEN_BOUND');
    const decomposition = scalars(scalar.normalize('NFD'));
    if (decomposition.length >= 2) {
      const left = decomposition.slice(0, -1).join('').normalize('NFC');
      const right = decomposition.at(-1);
      if (scalars(left).length === 1 && `${left}${right}`.normalize('NFC') === scalar) {
        primaryCompositionPairs.add(`${left}\0${right}`);
        maximum = observe(`${left}${right}`, maximum);
        if (STRUCTURAL_ASCII.has(scalar)) structuralCompositionCount += 1;
        if (inputBytes(normalizeMatchValue(`${left}${right}`)) > inputBytes(output(`${left}${right}`))) throw new Error('KSTACK_REFLEXION_UNICODE_ORACLE_TOKEN_BOUND');
      }
    }
    const precedingSequence = `A${scalar}\u03A3`;
    const precedingNormalized = precedingSequence.normalize('NFKC');
    let precedingCased = false;
    for (let index = scalars(precedingNormalized).length - 2; index >= 0; index -= 1) {
      const context = scalars(precedingNormalized)[index];
      if (CASE_IGNORABLE.test(context)) continue;
      precedingCased = CASED.test(context); break;
    }
    if (scalars(output(precedingSequence)).at(-1) !== (precedingCased ? '\u03C2' : '\u03C3')) throw new Error('KSTACK_REFLEXION_UNICODE_ORACLE_LOWERCASE');
    const followingSequence = `A\u03A3${scalar}A`;
    const followingNormalized = scalars(followingSequence.normalize('NFKC'));
    let followingCased = false;
    for (let index = 2; index < followingNormalized.length; index += 1) {
      const context = followingNormalized[index];
      if (CASE_IGNORABLE.test(context)) continue;
      followingCased = CASED.test(context); break;
    }
    if (scalars(output(followingSequence))[1] !== (followingCased ? '\u03C3' : '\u03C2')) throw new Error('KSTACK_REFLEXION_UNICODE_ORACLE_LOWERCASE');
    maximum = observe(precedingSequence, maximum);
    maximum = observe(followingSequence, maximum);
    conditionalContextCount += 2;
  }
  const maximizingScalar = String.fromCodePoint(maximum.firstCodePoint);
  const quoteCompositionSafe = '"'.normalize('NFD') === '"' && '"'.normalize('NFKD') === '"'
    && ![...primaryCompositionPairs].some((pair) => pair.split('\0').includes('"')) && structuralCompositionCount === 0;
  if (maximum.firstCodePoint !== 0xfdfa || maximum.inputBytes !== 3 || maximum.outputBytes !== 33
      || maximum.outputScalars !== 18 || normalizeMatchValue('\u0130') !== 'i\u0307'
      || normalizeMatchValue(maximizingScalar) !== 'صلى الله عليه وسلم' || scalarMaximumCount !== 1
      || !quoteCompositionSafe) throw new Error('KSTACK_REFLEXION_UNICODE_ORACLE_MISMATCH');
  const storedPoolUpperBound = 11 * 1_048_576;
  const queryPoolUpperBound = 32 * 10_240;
  const totalPoolUpperBound = storedPoolUpperBound + queryPoolUpperBound;
  const poolCap = 16_777_216;
  const marginBytes = poolCap - totalPoolUpperBound;
  const sourceDigest = crypto.createHash('sha256').update(JSON.stringify(sources)).digest('hex');
  const record = {
    kind: 'unicode-oracle-v1', node: process.versions.node, v8: process.versions.v8,
    icu: process.versions.icu, unicode: process.versions.unicode, scalarCount,
    primaryCompositionPairCount: primaryCompositionPairs.size, conditionalContextCount, maximizingScalar: 'U+FDFA',
    uniqueScalarMaximumCount: scalarMaximumCount, quoteCompositionSafe, tokenSplitBoundProved: true,
    inputBytes: 3, outputBytes: 33, outputScalars: 18, expansionRatio: 11,
    storedPoolUpperBound, queryPoolUpperBound, totalPoolUpperBound, poolCap,
    marginBytes, marginPercent: 29.296875, sourceDigest
  };
  return Object.freeze({ ...record, resultSha256: crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex') });
}
