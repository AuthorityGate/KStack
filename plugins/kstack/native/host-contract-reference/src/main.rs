use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use ed25519_dalek::{Signature, VerifyingKey};
use serde::de::{self, Deserialize, Deserializer, MapAccess, SeqAccess, Visitor};
use regex::Regex;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
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
            if !Regex::new(expression).map_err(|_| "schema")?.is_match(value) { return Ok(false); }
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
