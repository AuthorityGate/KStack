export function isWellFormedScalarString(value) {
  if (typeof value !== 'string') return false;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

export function scalarLength(value) {
  return [...value].length;
}

export function normalizeMatchValue(value) {
  if (!isWellFormedScalarString(value)) throw new TypeError('KSTACK_REFLEXION_SCALAR_SEQUENCE');
  return value.normalize('NFKC').toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean).join(' ');
}

