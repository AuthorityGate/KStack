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
        "actionUnproven", "bypassFound", "cleanupSucceeded", "closureOutcome",
        "coverageComplete", "environmentEqual", "fixtureAmbiguous", "fixtureFailed",
        "fixtureIncomplete", "inventoryUnknown", "logsComplete", "observerContradiction",
        "observerIntegrityError"
    ];
    if object.len() != expected.len() || expected.iter().any(|key| !object.contains_key(*key)) { return Err("shape"); }
    let closure = text(object, "closureOutcome")?;
    if !["PROVEN", "UNKNOWN", "UNAVAILABLE", "CONTRADICTORY"].contains(&closure) { return Err("outcome"); }
    let harness_error = closure == "CONTRADICTORY" || boolean(object, "observerIntegrityError")?;
    let ambiguous = boolean(object, "observerContradiction")?
        || boolean(object, "fixtureAmbiguous")?
        || boolean(object, "actionUnproven")?;
    let failed = boolean(object, "fixtureFailed")? || boolean(object, "bypassFound")?;
    let incomplete = closure != "PROVEN"
        || !boolean(object, "coverageComplete")?
        || boolean(object, "inventoryUnknown")?
        || boolean(object, "fixtureIncomplete")?
        || !boolean(object, "environmentEqual")?
        || !boolean(object, "cleanupSucceeded")?
        || !boolean(object, "logsComplete")?;
    let aggregate = if harness_error { "HARNESS_ERROR" }
        else if ambiguous { "AMBIGUOUS" }
        else if failed { "FAIL" }
        else if incomplete { "INCOMPLETE" }
        else { "PASS" };
    Ok(json!({ "aggregate": aggregate }))
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
