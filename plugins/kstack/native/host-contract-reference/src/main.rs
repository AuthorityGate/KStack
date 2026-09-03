use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use ed25519_dalek::{Signature, VerifyingKey};
use serde::de::{self, Deserialize, Deserializer, MapAccess, SeqAccess, Visitor};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fmt;
use std::io::{self, Read};
use unicode_normalization::UnicodeNormalization;

#[derive(Clone, Debug, PartialEq)]
enum StrictValue {
    Null,
    Bool(bool),
    Integer(i64),
    String(String),
    Array(Vec<StrictValue>),
    Object(Vec<(String, StrictValue)>),
}

struct StrictVisitor;

impl<'de> Visitor<'de> for StrictVisitor {
    type Value = StrictValue;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("a bounded JSON value")
    }

    fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> { Ok(StrictValue::Null) }
    fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> { Ok(StrictValue::Null) }
    fn visit_bool<E: de::Error>(self, value: bool) -> Result<Self::Value, E> { Ok(StrictValue::Bool(value)) }
    fn visit_i64<E: de::Error>(self, value: i64) -> Result<Self::Value, E> { Ok(StrictValue::Integer(value)) }
    fn visit_u64<E: de::Error>(self, value: u64) -> Result<Self::Value, E> {
        i64::try_from(value).map(StrictValue::Integer).map_err(|_| E::custom("integer"))
    }
    fn visit_f64<E: de::Error>(self, _value: f64) -> Result<Self::Value, E> { Err(E::custom("number")) }
    fn visit_str<E: de::Error>(self, value: &str) -> Result<Self::Value, E> { Ok(StrictValue::String(value.to_owned())) }
    fn visit_string<E: de::Error>(self, value: String) -> Result<Self::Value, E> { Ok(StrictValue::String(value)) }

    fn visit_seq<A: SeqAccess<'de>>(self, mut sequence: A) -> Result<Self::Value, A::Error> {
        let mut values = Vec::new();
        while let Some(value) = sequence.next_element::<StrictValue>()? {
            if values.len() >= 1024 { return Err(de::Error::custom("array")); }
            values.push(value);
        }
        Ok(StrictValue::Array(values))
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
        let mut values = Vec::new();
        let mut keys = HashSet::new();
        while let Some(key) = map.next_key::<String>()? {
            if values.len() >= 64 { return Err(de::Error::custom("object")); }
            if !keys.insert(key.clone()) { return Err(de::Error::custom("duplicate")); }
            values.push((key, map.next_value::<StrictValue>()?));
        }
        Ok(StrictValue::Object(values))
    }
}

impl<'de> Deserialize<'de> for StrictValue {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(StrictVisitor)
    }
}

fn reject_noncanonical_string(value: &str) -> Result<(), &'static str> {
    if value.as_bytes().len() > 16384 || value.nfc().ne(value.chars()) { return Err("string"); }
    if value.chars().any(|character| {
        let point = character as u32;
        (0xfdd0..=0xfdef).contains(&point) || point & 0xffff == 0xfffe || point & 0xffff == 0xffff
    }) { return Err("noncharacter"); }
    Ok(())
}

fn validate(value: &StrictValue, depth: usize) -> Result<(), &'static str> {
    if depth > 32 { return Err("depth"); }
    match value {
        StrictValue::Null | StrictValue::Bool(_) => Ok(()),
        StrictValue::Integer(number) => {
            if number.unsigned_abs() > 9_007_199_254_740_991 { Err("integer") } else { Ok(()) }
        }
        StrictValue::String(text) => reject_noncanonical_string(text),
        StrictValue::Array(values) => values.iter().try_for_each(|member| validate(member, depth + 1)),
        StrictValue::Object(entries) => entries.iter().try_for_each(|(key, member)| {
            reject_noncanonical_string(key)?;
            validate(member, depth + 1)
        }),
    }
}

fn encode_string(value: &str, output: &mut Vec<u8>) -> Result<(), &'static str> {
    let encoded = serde_json::to_string(value).map_err(|_| "string")?;
    output.extend_from_slice(encoded.as_bytes());
    Ok(())
}

fn canonical(value: &StrictValue, output: &mut Vec<u8>) -> Result<(), &'static str> {
    match value {
        StrictValue::Null => output.extend_from_slice(b"null"),
        StrictValue::Bool(true) => output.extend_from_slice(b"true"),
        StrictValue::Bool(false) => output.extend_from_slice(b"false"),
        StrictValue::Integer(number) => output.extend_from_slice(number.to_string().as_bytes()),
        StrictValue::String(text) => encode_string(text, output)?,
        StrictValue::Array(values) => {
            output.push(b'[');
            for (index, member) in values.iter().enumerate() {
                if index > 0 { output.push(b','); }
                canonical(member, output)?;
            }
            output.push(b']');
        }
        StrictValue::Object(entries) => {
            let mut ordered: Vec<&(String, StrictValue)> = entries.iter().collect();
            ordered.sort_by(|left, right| left.0.encode_utf16().cmp(right.0.encode_utf16()));
            output.push(b'{');
            for (index, (key, member)) in ordered.iter().enumerate() {
                if index > 0 { output.push(b','); }
                encode_string(key, output)?;
                output.push(b':');
                canonical(member, output)?;
            }
            output.push(b'}');
        }
    }
    Ok(())
}

fn member<'a>(value: &'a StrictValue, name: &str) -> Option<&'a StrictValue> {
    let StrictValue::Object(entries) = value else { return None; };
    entries.iter().find_map(|(key, value)| (key == name).then_some(value))
}

fn text(value: &StrictValue) -> Option<&str> {
    if let StrictValue::String(value) = value { Some(value) } else { None }
}

fn integer(value: &StrictValue) -> Option<i64> {
    if let StrictValue::Integer(value) = value { Some(*value) } else { None }
}

fn array(value: &StrictValue) -> Option<&[StrictValue]> {
    if let StrictValue::Array(value) = value { Some(value) } else { None }
}

fn equal_value(left: &StrictValue, right: &StrictValue) -> Result<bool, &'static str> {
    let mut left_bytes = Vec::new();
    let mut right_bytes = Vec::new();
    canonical(left, &mut left_bytes)?;
    canonical(right, &mut right_bytes)?;
    Ok(left_bytes == right_bytes)
}

fn collection_key(value: &StrictValue, fields: &[StrictValue], kinds: &[StrictValue]) -> Result<Vec<u8>, &'static str> {
    if fields.len() != kinds.len() || fields.is_empty() || fields.len() > 4 { return Err("collection"); }
    let mut output = Vec::new();
    for (field, kind) in fields.iter().zip(kinds) {
        let field = text(field).ok_or("collection")?;
        let kind = text(kind).ok_or("collection")?;
        let scalar = member(value, field).ok_or("collection")?;
        let bytes = match (kind, scalar) {
            ("ASCII", StrictValue::String(value)) | ("DIGEST", StrictValue::String(value)) => value.as_bytes().to_vec(),
            ("ASCII_CANONICAL_UINT", StrictValue::Integer(value)) if *value >= 0 => value.to_string().into_bytes(),
            _ => return Err("collection"),
        };
        output.extend_from_slice(format!("{:08x}", bytes.len()).as_bytes());
        output.extend_from_slice(&bytes);
    }
    Ok(output)
}

fn validate_collection(values: &[StrictValue], declaration: &StrictValue) -> Result<bool, &'static str> {
    let mode = member(declaration, "mode").and_then(text).ok_or("collection")?;
    if mode == "ORDERED" { return Ok(true); }
    let fields = member(declaration, "keyFields").and_then(array).unwrap_or(&[]);
    let kinds = member(declaration, "keyKinds").and_then(array).unwrap_or(&[]);
    let mut prior: Option<Vec<u8>> = None;
    for value in values {
        let key = match mode {
            "SET_BY_VALUE_ASCII" | "SET_BY_VALUE_DIGEST" => text(value).ok_or("collection")?.as_bytes().to_vec(),
            "SET_BY_FIELDS" => collection_key(value, fields, kinds)?,
            _ => return Err("collection"),
        };
        if prior.as_ref().is_some_and(|previous| previous >= &key) { return Ok(false); }
        prior = Some(key);
    }
    Ok(true)
}

// Closed-pattern engine. This is a direct port of the JavaScript reference in
// plugins/kstack/scripts/kstack-host-contract.mjs (compileClosedPattern,
// parseClosedPatternAtoms, buildClosedPatternNfa, closedPatternAlphabet and
// determinizeClosedPattern). It exists so both bound implementations decide the
// same closed-pattern language: `.` is a literal ASCII character rather than a
// wildcard, `[^...]` negation is outside the frozen grammar and is rejected, and
// the declared 4,096-DFA-state bound is enforced by real subset construction.
// A general-purpose regular-expression engine cannot be used here without
// forking the language away from the JavaScript implementation.

const MAX_PATTERN_BYTES: usize = 256;
const MAX_PATTERN_DFA_STATES: usize = 4_096;
const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

struct ClosedAtom {
    members: u128,
    min: u64,
    max: Option<u64>,
}

struct ClosedNfa {
    eps: Vec<Vec<usize>>,
    members: Vec<Option<usize>>,
    next: Vec<usize>,
    start: usize,
    accept: usize,
}

impl ClosedNfa {
    fn new() -> Self {
        ClosedNfa { eps: Vec::new(), members: Vec::new(), next: Vec::new(), start: 0, accept: 0 }
    }

    fn new_state(&mut self) -> usize {
        self.eps.push(Vec::new());
        self.members.push(None);
        self.next.push(usize::MAX);
        self.eps.len() - 1
    }

    fn occurrence(&mut self, set: usize) -> (usize, usize) {
        let from = self.new_state();
        let to = self.new_state();
        self.members[from] = Some(set);
        self.next[from] = to;
        (from, to)
    }
}

struct ClosedAlphabet {
    symbol_of: [usize; 128],
    symbol_count: usize,
    admits: Vec<Vec<bool>>,
}

struct ClosedPattern {
    symbol_of: [usize; 128],
    accepting: Vec<bool>,
    transitions: Vec<Vec<i32>>,
}

impl ClosedPattern {
    fn test(&self, value: &str) -> bool {
        let mut current: i32 = 0;
        for byte in value.bytes() {
            if byte >= 0x80 { return false; }
            let symbol = self.symbol_of[byte as usize];
            if symbol == 0 { return false; }
            current = self.transitions[current as usize][symbol];
            if current < 0 { return false; }
        }
        self.accepting[current as usize]
    }
}

fn closed_pattern_bounded_number(digits: &[u8]) -> Result<u64, &'static str> {
    let mut value: u64 = 0;
    for digit in digits {
        value = value
            .saturating_mul(10)
            .saturating_add(u64::from(digit - b'0'));
        if value > MAX_SAFE_INTEGER { return Err("pattern"); }
    }
    Ok(value)
}

fn closed_pattern_class_members(content: &[u8]) -> Result<u128, &'static str> {
    if content.first() == Some(&b'^') { return Err("pattern"); }
    let mut members: u128 = 0;
    let mut index = 0usize;
    while index < content.len() {
        let first = content[index];
        if index + 2 < content.len() && content[index + 1] == b'-' {
            let last = content[index + 2];
            if first > last { return Err("pattern"); }
            for code in first..=last { members |= 1u128 << code; }
            index += 3;
        } else {
            members |= 1u128 << first;
            index += 1;
        }
    }
    Ok(members)
}

// Mirrors the `\{([0-9]+)(?:,([0-9]+))?\}` branch of the JavaScript token regex.
// Ok(None) means the brace run is not a well-formed quantifier, in which case the
// JavaScript regex matches the empty quantifier and the following `{` fails as an
// atom on the next iteration; Err means the shape matched but a bound is not a
// safe integer, which the JavaScript implementation rejects outright.
fn closed_pattern_repetition(body: &[u8], start: usize) -> Result<Option<(u64, u64, usize)>, &'static str> {
    let mut index = start + 1;
    let low_start = index;
    while index < body.len() && body[index].is_ascii_digit() { index += 1; }
    if index == low_start { return Ok(None); }
    let low_digits = &body[low_start..index];
    if index < body.len() && body[index] == b'}' {
        let value = closed_pattern_bounded_number(low_digits)?;
        return Ok(Some((value, value, index + 1)));
    }
    if index < body.len() && body[index] == b',' {
        index += 1;
        let high_start = index;
        while index < body.len() && body[index].is_ascii_digit() { index += 1; }
        if index == high_start || index >= body.len() || body[index] != b'}' { return Ok(None); }
        let low = closed_pattern_bounded_number(low_digits)?;
        let high = closed_pattern_bounded_number(&body[high_start..index])?;
        return Ok(Some((low, high, index + 1)));
    }
    Ok(None)
}

fn parse_closed_pattern_atoms(body: &[u8]) -> Result<Vec<ClosedAtom>, &'static str> {
    let mut atoms: Vec<ClosedAtom> = Vec::new();
    let mut offset = 0usize;
    // Cheap parse-time guard on NFA size (sum of quantifier maxima), not a
    // DFA-state count; the declared 4,096-state bound is enforced in
    // determinize_closed_pattern below.
    let mut nfa_size_guard: u64 = 1;
    while offset < body.len() {
        let (members, atom_end) = if body[offset] == b'[' {
            let mut scan = offset + 1;
            while scan < body.len() && body[scan] != b']' && body[scan] != b'\\' { scan += 1; }
            if scan >= body.len() || body[scan] != b']' || scan == offset + 1 { return Err("pattern"); }
            (closed_pattern_class_members(&body[offset + 1..scan])?, scan + 1)
        } else {
            let byte = body[offset];
            if !(byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b':' | b'.' | b'-')) { return Err("pattern"); }
            (1u128 << byte, offset + 1)
        };
        let mut min: u64 = 1;
        let mut max: Option<u64> = Some(1);
        let mut cursor = atom_end;
        if cursor < body.len() {
            match body[cursor] {
                b'?' => { min = 0; max = Some(1); cursor += 1; }
                b'*' => { min = 0; max = None; cursor += 1; }
                b'+' => { min = 1; max = None; cursor += 1; }
                b'{' => {
                    if let Some((low, high, end)) = closed_pattern_repetition(body, cursor)? {
                        if low > high { return Err("pattern"); }
                        min = low;
                        max = Some(high);
                        cursor = end;
                    }
                }
                _ => {}
            }
        }
        nfa_size_guard = nfa_size_guard.saturating_add(match max { None => 2, Some(value) => value });
        if nfa_size_guard > MAX_PATTERN_DFA_STATES as u64 { return Err("pattern"); }
        atoms.push(ClosedAtom { members, min, max });
        offset = cursor;
    }
    Ok(atoms)
}

fn build_closed_pattern_nfa(atoms: &[ClosedAtom], set_of_atom: &[usize]) -> ClosedNfa {
    let mut nfa = ClosedNfa::new();
    let start = nfa.new_state();
    nfa.start = start;
    let mut cursor = start;
    for (atom, &set) in atoms.iter().zip(set_of_atom) {
        for _ in 0..atom.min {
            let (entry, exit) = nfa.occurrence(set);
            nfa.eps[cursor].push(entry);
            cursor = exit;
        }
        match atom.max {
            None => {
                let repeat = nfa.new_state();
                nfa.eps[cursor].push(repeat);
                let (entry, exit) = nfa.occurrence(set);
                nfa.eps[repeat].push(entry);
                nfa.eps[exit].push(repeat);
                cursor = repeat;
            }
            Some(max) if max > atom.min => {
                let exit_state = nfa.new_state();
                for _ in atom.min..max {
                    nfa.eps[cursor].push(exit_state);
                    let (entry, exit) = nfa.occurrence(set);
                    nfa.eps[cursor].push(entry);
                    cursor = exit;
                }
                nfa.eps[cursor].push(exit_state);
                cursor = exit_state;
            }
            _ => {}
        }
    }
    nfa.accept = cursor;
    nfa
}

fn closed_pattern_alphabet(sets: &[u128]) -> ClosedAlphabet {
    let words = sets.len().div_ceil(64).max(1);
    let mut symbol_of = [0usize; 128];
    let mut identifiers: HashMap<Vec<u64>, usize> = HashMap::new();
    let mut symbol_count = 1usize;
    for code in 0..128usize {
        let mut signature = vec![0u64; words];
        let mut present = false;
        for (index, set) in sets.iter().enumerate() {
            if (set >> code) & 1 == 1 {
                signature[index >> 6] |= 1u64 << (index & 63);
                present = true;
            }
        }
        if !present { continue; }
        let symbol = *identifiers.entry(signature).or_insert_with(|| {
            let assigned = symbol_count;
            symbol_count += 1;
            assigned
        });
        symbol_of[code] = symbol;
    }
    let mut admits = Vec::with_capacity(sets.len());
    for set in sets {
        let mut mask = vec![false; symbol_count];
        for code in 0..128usize {
            if (set >> code) & 1 == 1 { mask[symbol_of[code]] = true; }
        }
        admits.push(mask);
    }
    ClosedAlphabet { symbol_of, symbol_count, admits }
}

fn closed_pattern_closure(nfa: &ClosedNfa, words: usize, marks: &mut [u32], generation: &mut u32, seeds: &[usize]) -> Vec<u64> {
    *generation += 1;
    let mut bits = vec![0u64; words];
    let mut stack: Vec<usize> = Vec::new();
    for &seed in seeds {
        if marks[seed] != *generation { marks[seed] = *generation; stack.push(seed); }
    }
    while let Some(current) = stack.pop() {
        bits[current >> 6] |= 1u64 << (current & 63);
        for &target in &nfa.eps[current] {
            if marks[target] != *generation { marks[target] = *generation; stack.push(target); }
        }
    }
    bits
}

fn determinize_closed_pattern(nfa: &ClosedNfa, alphabet: &ClosedAlphabet) -> Result<(Vec<bool>, Vec<Vec<i32>>), &'static str> {
    let words = nfa.eps.len().div_ceil(64).max(1);
    let mut marks = vec![0u32; nfa.eps.len()];
    let mut generation = 0u32;
    let mut identifiers: HashMap<Vec<u64>, usize> = HashMap::new();
    let mut subsets: Vec<Vec<u64>> = Vec::new();
    let mut accepting: Vec<bool> = Vec::new();
    let mut transitions: Vec<Vec<i32>> = Vec::new();
    let accept = nfa.accept;
    let symbol_count = alphabet.symbol_count;

    // This intern step is the single place that enforces the declared 4,096
    // DFA-state bound from the frozen design: a pattern whose real subset
    // construction would need more than 4,096 distinct states is rejected here.
    let intern = |bits: Vec<u64>,
                      identifiers: &mut HashMap<Vec<u64>, usize>,
                      subsets: &mut Vec<Vec<u64>>,
                      accepting: &mut Vec<bool>,
                      transitions: &mut Vec<Vec<i32>>| -> Result<usize, &'static str> {
        if let Some(&existing) = identifiers.get(&bits) { return Ok(existing); }
        if identifiers.len() >= MAX_PATTERN_DFA_STATES { return Err("pattern"); }
        let identifier = identifiers.len();
        accepting.push((bits[accept >> 6] >> (accept & 63)) & 1 == 1);
        transitions.push(vec![-1i32; symbol_count]);
        subsets.push(bits.clone());
        identifiers.insert(bits, identifier);
        Ok(identifier)
    };

    let initial = closed_pattern_closure(nfa, words, &mut marks, &mut generation, &[nfa.start]);
    intern(initial, &mut identifiers, &mut subsets, &mut accepting, &mut transitions)?;

    let mut identifier = 0usize;
    let mut members: Vec<usize> = Vec::new();
    let mut moved: Vec<usize> = Vec::new();
    while identifier < subsets.len() {
        members.clear();
        for word in 0..words {
            let mut remaining = subsets[identifier][word];
            while remaining != 0 {
                let lowest = remaining & remaining.wrapping_neg();
                let source = (word << 6) + lowest.trailing_zeros() as usize;
                if nfa.members[source].is_some() { members.push(source); }
                remaining ^= lowest;
            }
        }
        for symbol in 1..symbol_count {
            moved.clear();
            for &source in &members {
                let set = nfa.members[source].expect("member state");
                if alphabet.admits[set][symbol] { moved.push(nfa.next[source]); }
            }
            if moved.is_empty() { continue; }
            let bits = closed_pattern_closure(nfa, words, &mut marks, &mut generation, &moved);
            let target = intern(bits, &mut identifiers, &mut subsets, &mut accepting, &mut transitions)?;
            transitions[identifier][symbol] = target as i32;
        }
        identifier += 1;
    }
    Ok((accepting, transitions))
}

fn compile_closed_pattern(pattern: &str) -> Result<ClosedPattern, &'static str> {
    let bytes = pattern.as_bytes();
    if bytes.is_empty() || bytes.len() > MAX_PATTERN_BYTES { return Err("pattern"); }
    if !bytes.iter().all(|byte| (0x20..=0x7e).contains(byte)) { return Err("pattern"); }
    if bytes[0] != b'^' || bytes[bytes.len() - 1] != b'$' || bytes.len() < 2 { return Err("pattern"); }
    let atoms = parse_closed_pattern_atoms(&bytes[1..bytes.len() - 1])?;
    let mut sets: Vec<u128> = Vec::new();
    let mut set_of_atom: Vec<usize> = Vec::with_capacity(atoms.len());
    for atom in &atoms {
        let index = match sets.iter().position(|candidate| *candidate == atom.members) {
            Some(index) => index,
            None => { sets.push(atom.members); sets.len() - 1 }
        };
        set_of_atom.push(index);
    }
    let alphabet = closed_pattern_alphabet(&sets);
    let nfa = build_closed_pattern_nfa(&atoms, &set_of_atom);
    let (accepting, transitions) = determinize_closed_pattern(&nfa, &alphabet)?;
    Ok(ClosedPattern { symbol_of: alphabet.symbol_of, accepting, transitions })
}

fn matches_type(expected: &str, value: &StrictValue) -> bool {
    matches!((expected, value),
        ("null", StrictValue::Null)
        | ("boolean", StrictValue::Bool(_))
        | ("integer", StrictValue::Integer(_))
        | ("string", StrictValue::String(_))
        | ("array", StrictValue::Array(_))
        | ("object", StrictValue::Object(_)))
}

fn matches_schema(schema: &StrictValue, value: &StrictValue, depth: usize) -> Result<bool, &'static str> {
    if depth > 32 { return Err("depth"); }
    let StrictValue::Object(_) = schema else { return Err("schema"); };

    if let Some(expected) = member(schema, "type") {
        let expected = text(expected).ok_or("schema")?;
        if !matches_type(expected, value) { return Ok(false); }
    }
    if let Some(expected) = member(schema, "const") {
        if !equal_value(expected, value)? { return Ok(false); }
    }
    if let Some(choices) = member(schema, "enum") {
        let choices = array(choices).ok_or("schema")?;
        let mut found = false;
        for choice in choices {
            if equal_value(choice, value)? { found = true; break; }
        }
        if !found { return Ok(false); }
    }

    if let StrictValue::String(value) = value {
        let length = value.chars().count() as i64;
        if member(schema, "minLength").and_then(integer).is_some_and(|bound| length < bound)
            || member(schema, "maxLength").and_then(integer).is_some_and(|bound| length > bound) {
            return Ok(false);
        }
        if let Some(pattern) = member(schema, "pattern") {
            let expression = text(pattern).ok_or("schema")?;
            if !compile_closed_pattern(expression)?.test(value) { return Ok(false); }
        }
    }

    if let StrictValue::Integer(value) = value {
        if member(schema, "minimum").and_then(integer).is_some_and(|bound| *value < bound)
            || member(schema, "maximum").and_then(integer).is_some_and(|bound| *value > bound) {
            return Ok(false);
        }
    }

    if let StrictValue::Array(values) = value {
        let length = values.len() as i64;
        if member(schema, "minItems").and_then(integer).is_some_and(|bound| length < bound)
            || member(schema, "maxItems").and_then(integer).is_some_and(|bound| length > bound) {
            return Ok(false);
        }
        if let Some(item_schema) = member(schema, "items") {
            for item in values {
                if !matches_schema(item_schema, item, depth + 1)? { return Ok(false); }
            }
        }
        if let Some(declaration) = member(schema, "x-kstack-collection") {
            if !validate_collection(values, declaration).unwrap_or(false) { return Ok(false); }
        }
    }

    if let StrictValue::Object(entries) = value {
        if member(schema, "type").and_then(text) == Some("object") {
            let properties = member(schema, "properties").ok_or("schema")?;
            let StrictValue::Object(property_entries) = properties else { return Err("schema"); };
            let required = member(schema, "required").and_then(array).ok_or("schema")?;
            if member(schema, "additionalProperties") != Some(&StrictValue::Bool(false)) { return Err("schema"); }
            for required_name in required {
                let required_name = text(required_name).ok_or("schema")?;
                if !entries.iter().any(|(name, _)| name == required_name) { return Ok(false); }
            }
            for (name, item) in entries {
                let Some((_, property_schema)) = property_entries.iter().find(|(key, _)| key == name) else { return Ok(false); };
                if !matches_schema(property_schema, item, depth + 1)? { return Ok(false); }
            }
        }
    }

    if let Some(branches) = member(schema, "oneOf") {
        let branches = array(branches).ok_or("schema")?;
        let mut matches = 0;
        for branch in branches {
            if matches_schema(branch, value, depth + 1)? { matches += 1; }
        }
        if matches != 1 { return Ok(false); }
    }
    Ok(true)
}

fn valid_domain(value: &str) -> bool {
    if !value.starts_with("KSTACK-") || value.len() > 128 || !value.is_ascii() { return false; }
    let Some(version) = value.rsplit_once("-V") else { return false; };
    version.0.len() > 7
        && !version.1.is_empty()
        && version.1.bytes().all(|byte| byte.is_ascii_digit())
        && value.bytes().all(|byte| byte.is_ascii_uppercase() || byte.is_ascii_digit() || byte == b'-')
}

fn execute(input: &[u8]) -> Result<String, &'static str> {
    if input.len() > 1_048_576 { return Err("bytes"); }
    let request: StrictValue = serde_json::from_slice(input).map_err(|_| "json")?;
    let StrictValue::Object(ref entries) = request else { return Err("request"); };
    if entries.len() == 1 {
        let vector = entries.iter().find_map(|(key, value)| (key == "ed25519").then_some(value)).ok_or("request")?;
        let StrictValue::Object(fields) = vector else { return Err("request"); };
        if fields.len() != 3 { return Err("request"); }
        let public_key = member(vector, "publicKey").and_then(text).ok_or("request")?;
        let signature = member(vector, "signature").and_then(text).ok_or("request")?;
        let message_hex = member(vector, "messageHex").and_then(text).ok_or("request")?;
        let public_der = URL_SAFE_NO_PAD.decode(public_key).map_err(|_| "key")?;
        const ED25519_SPKI_PREFIX: &[u8] = &[0x30,0x2a,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x03,0x21,0x00];
        if public_der.len() != ED25519_SPKI_PREFIX.len() + 32 || !public_der.starts_with(ED25519_SPKI_PREFIX) { return Err("key"); }
        let key_bytes: [u8; 32] = public_der[ED25519_SPKI_PREFIX.len()..].try_into().map_err(|_| "key")?;
        let verifying_key = VerifyingKey::from_bytes(&key_bytes).map_err(|_| "key")?;
        let signature_bytes = URL_SAFE_NO_PAD.decode(signature).map_err(|_| "signature")?;
        let signature_array: [u8; 64] = signature_bytes.try_into().map_err(|_| "signature")?;
        let signature = Signature::from_bytes(&signature_array);
        let message = hex::decode(message_hex).map_err(|_| "message")?;
        return Ok(format!("{{\"valid\":{}}}\n", verifying_key.verify_strict(&message, &signature).is_ok()));
    }
    if entries.len() != 2 { return Err("request"); }
    let value = entries.iter().find_map(|(key, value)| (key == "value").then_some(value)).ok_or("request")?;
    validate(&request, 0)?;
    if let Some(schema) = entries.iter().find_map(|(key, value)| (key == "schema").then_some(value)) {
        if entries.iter().any(|(key, _)| key != "schema" && key != "value") { return Err("request"); }
        return Ok(format!("{{\"valid\":{}}}\n", matches_schema(schema, value, 0)?));
    }
    let domain = entries.iter().find_map(|(key, value)| match (key.as_str(), value) {
        ("domain", StrictValue::String(text)) => Some(text.as_str()),
        _ => None,
    }).ok_or("request")?;
    if entries.iter().any(|(key, _)| key != "domain" && key != "value") || !valid_domain(domain) { return Err("domain"); }
    let mut body = Vec::new();
    canonical(value, &mut body)?;
    if body.len() > 1_048_576 { return Err("bytes"); }
    let mut hasher = Sha256::new();
    hasher.update(domain.as_bytes());
    hasher.update([0]);
    hasher.update(&body);
    Ok(format!(
        "{{\"canonicalHex\":\"{}\",\"objectDigest\":\"sha256:{}\"}}\n",
        hex::encode(body), hex::encode(hasher.finalize())
    ))
}

fn main() {
    let mut input = Vec::new();
    if io::stdin().read_to_end(&mut input).is_err() {
        eprintln!("IO");
        std::process::exit(2);
    }
    match execute(&input) {
        Ok(response) => print!("{response}"),
        Err(_) => {
            eprintln!("INVALID");
            std::process::exit(2);
        }
    }
}
