use serde_json::{Value, json};
use std::io::{self, Read};

fn boolean(object: &serde_json::Map<String, Value>, name: &str) -> Result<bool, &'static str> {
    object.get(name).and_then(Value::as_bool).ok_or("shape")
}

fn integer(object: &serde_json::Map<String, Value>, name: &str) -> Result<u64, &'static str> {
    object.get(name).and_then(Value::as_u64).ok_or("shape")
}

fn text<'a>(object: &'a serde_json::Map<String, Value>, name: &str) -> Result<&'a str, &'static str> {
    object.get(name).and_then(Value::as_str).ok_or("shape")
}

fn evaluate(input: &[u8]) -> Result<Value, &'static str> {
    if input.len() > 65_536 { return Err("bytes"); }
    let value: Value = serde_json::from_slice(input).map_err(|_| "json")?;
    let object = value.as_object().ok_or("shape")?;
    let expected = [
        "authorityTier", "brokerControlCount", "echoMatches", "effectCoverageComplete",
        "otherRequirementsProven", "privilegeTier", "proofsProven", "provenanceProven"
    ];
    if object.len() != expected.len() || expected.iter().any(|key| !object.contains_key(*key)) { return Err("shape"); }
    let authority = text(object, "authorityTier")?;
    let privilege = text(object, "privilegeTier")?;
    if !["allow", "ask", "deny"].contains(&authority) || !["ordinary", "privileged"].contains(&privilege) { return Err("enum"); }
    let required = authority == "ask" || privilege == "privileged";
    let controls = integer(object, "brokerControlCount")?;
    let structural = boolean(object, "provenanceProven")?
        && boolean(object, "echoMatches")?
        && authority != "deny"
        && (!required || controls == 1
            && boolean(object, "proofsProven")?
            && boolean(object, "effectCoverageComplete")?);
    let conjunctive = structural && boolean(object, "otherRequirementsProven")?;
    Ok(json!({ "brokerRequired": required, "conjunctiveEligible": conjunctive, "structuralSatisfied": structural }))
}

fn main() {
    let mut input = Vec::new();
    if io::stdin().read_to_end(&mut input).is_err() { std::process::exit(2); }
    match evaluate(&input) {
        Ok(result) => println!("{result}"),
        Err(_) => std::process::exit(2)
    }
}
