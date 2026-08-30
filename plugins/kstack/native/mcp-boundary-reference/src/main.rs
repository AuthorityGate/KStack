use serde_json::{Value, json};
use std::io::{self, Read};

fn boolean(object: &serde_json::Map<String, Value>, name: &str) -> Result<bool, &'static str> {
    object.get(name).and_then(Value::as_bool).ok_or("shape")
}

fn evaluate_one(value: &Value) -> Result<Value, &'static str> {
    let object = value.as_object().ok_or("shape")?;
    let expected = ["profile", "publicMethod", "publicProjectionValid", "transportQualified", "principalAuthenticated", "sessionActive", "sequenceValid", "capabilityAdvertised", "aclExact", "outputAdmissible", "releaseContextEqual"];
    if object.len() != expected.len() || expected.iter().any(|key| !object.contains_key(*key)) { return Err("shape"); }
    let profile = object.get("profile").and_then(Value::as_str).ok_or("shape")?;
    if !["PUBLIC", "RESTRICTED"].contains(&profile) { return Err("enum"); }
    let public_method = boolean(object, "publicMethod")?;
    let public_projection = boolean(object, "publicProjectionValid")?;
    let transport = boolean(object, "transportQualified")?;
    let principal = boolean(object, "principalAuthenticated")?;
    let session = boolean(object, "sessionActive")?;
    let sequence = boolean(object, "sequenceValid")?;
    let capability = boolean(object, "capabilityAdvertised")?;
    let acl = boolean(object, "aclExact")?;
    let output = boolean(object, "outputAdmissible")?;
    let release = boolean(object, "releaseContextEqual")?;
    let disposition = if profile == "PUBLIC" {
        if public_method && public_projection { "PUBLIC_RELEASE" } else { "DENY" }
    } else if !(transport && principal && session && sequence && capability && acl) {
        "DENY"
    } else if !(output && release) {
        "SUPPRESS"
    } else {
        "RESTRICTED_RELEASE"
    };
    Ok(json!({ "disposition": disposition }))
}

fn evaluate(input: &[u8]) -> Result<Value, &'static str> {
    if input.len() > 1_048_576 { return Err("bytes"); }
    let value: Value = serde_json::from_slice(input).map_err(|_| "json")?;
    if let Some(batch) = value.as_array() {
        if batch.is_empty() || batch.len() > 2_048 { return Err("batch"); }
        return batch.iter().map(evaluate_one).collect::<Result<Vec<_>, _>>().map(Value::Array);
    }
    evaluate_one(&value)
}

fn main() {
    let mut input = Vec::new();
    if io::stdin().read_to_end(&mut input).is_err() { eprintln!("IO"); std::process::exit(2); }
    match evaluate(&input) {
        Ok(result) => println!("{result}"),
        Err(_) => { eprintln!("INVALID"); std::process::exit(2); }
    }
}
