use serde_json::{Value, json};
use std::io::{self, Read};

fn boolean(object: &serde_json::Map<String, Value>, name: &str) -> Result<bool, &'static str> {
    object.get(name).and_then(Value::as_bool).ok_or("shape")
}

fn text<'a>(object: &'a serde_json::Map<String, Value>, name: &str) -> Result<&'a str, &'static str> {
    object.get(name).and_then(Value::as_str).ok_or("shape")
}

fn evaluate(input: &[u8]) -> Result<Value, &'static str> {
    if input.len() > 65_536 { return Err("bytes"); }
    let value: Value = serde_json::from_slice(input).map_err(|_| "json")?;
    let object = value.as_object().ok_or("shape")?;
    let expected = [
        "absoluteDeny", "activeQuarantine", "alternateValid", "contextMismatch",
        "evidenceOutcome", "primaryMissing"
    ];
    if object.len() != expected.len() || expected.iter().any(|key| !object.contains_key(*key)) { return Err("shape"); }
    let absolute_deny = boolean(object, "absoluteDeny")?;
    let active_quarantine = boolean(object, "activeQuarantine")?;
    let alternate_valid = boolean(object, "alternateValid")?;
    let context_mismatch = boolean(object, "contextMismatch")?;
    let primary_missing = boolean(object, "primaryMissing")?;
    let evidence = text(object, "evidenceOutcome")?;
    if !["VALID", "INVALID", "CONTRADICTORY", "STALE", "UNAVAILABLE"].contains(&evidence) { return Err("outcome"); }
    let status = if context_mismatch || active_quarantine || matches!(evidence, "INVALID" | "CONTRADICTORY") {
        "QUARANTINED"
    } else if absolute_deny || matches!(evidence, "STALE" | "UNAVAILABLE") {
        "UNSUPPORTED"
    } else if !primary_missing {
        "FULL"
    } else if alternate_valid {
        "DEGRADED_REGISTERED"
    } else {
        "UNSUPPORTED"
    };
    Ok(json!({ "status": status }))
}

fn main() {
    let mut input = Vec::new();
    if io::stdin().read_to_end(&mut input).is_err() {
        eprintln!("IO");
        std::process::exit(2);
    }
    match evaluate(&input) {
        Ok(result) => println!("{result}"),
        Err(_) => {
            eprintln!("INVALID");
            std::process::exit(2);
        }
    }
}
