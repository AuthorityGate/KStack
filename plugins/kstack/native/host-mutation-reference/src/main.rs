use serde_json::{Value, json};
use std::io::{self, Read};

fn text<'a>(object: &'a serde_json::Map<String, Value>, name: &str) -> Result<&'a str, &'static str> {
    object.get(name).and_then(Value::as_str).ok_or("shape")
}

fn boolean(object: &serde_json::Map<String, Value>, name: &str) -> Result<bool, &'static str> {
    object.get(name).and_then(Value::as_bool).ok_or("shape")
}

fn evaluate_one(value: &Value) -> Result<Value, &'static str> {
    let object = value.as_object().ok_or("shape")?;
    let expected = ["operationKind", "durableState", "namespacePredicate", "parentIdentitiesValid", "observerAgreement", "ledgerValid"];
    if object.len() != expected.len() || expected.iter().any(|key| !object.contains_key(*key)) { return Err("shape"); }
    let kind = text(object, "operationKind")?;
    let state = text(object, "durableState")?;
    let predicate = text(object, "namespacePredicate")?;
    let kinds = ["CREATE_DIRECTORY", "CREATE_FILE", "DELETE_EMPTY_DIRECTORY", "DELETE_FILE", "RENAME_WITHIN_ROOT", "REPLACE_FILE"];
    let states = ["PLANNED", "LOCKED", "PREPARED", "COMMIT_INTENT", "COMMITTED", "ROLLED_BACK", "ABORTED", "OUTCOME_AMBIGUOUS", "CLEANUP_INTENT", "CLEANED"];
    let predicates = ["NO_OP", "COMMITTED", "STAGING_PRESENT", "STAGING_ABSENT", "OTHER"];
    if !kinds.contains(&kind) || !states.contains(&state) || !predicates.contains(&predicate) { return Err("enum"); }
    let identities = boolean(object, "parentIdentitiesValid")?;
    let observers = boolean(object, "observerAgreement")?;
    let ledger = boolean(object, "ledgerValid")?;
    let cleanup_kind = ["CREATE_FILE", "REPLACE_FILE", "CREATE_DIRECTORY"].contains(&kind);
    let result = if !identities || !observers || !ledger { "OUTCOME_AMBIGUOUS" }
        else if state == "COMMIT_INTENT" && predicate == "COMMITTED" { "COMMITTED" }
        else if state == "COMMIT_INTENT" && predicate == "NO_OP" { "ABORTED" }
        else if state == "ABORTED" && cleanup_kind && predicate == "STAGING_PRESENT" { "CLEANUP_INTENT" }
        else if state == "ABORTED" && !cleanup_kind && predicate == "NO_OP" { "ABORTED" }
        else if state == "CLEANUP_INTENT" && cleanup_kind && predicate == "STAGING_PRESENT" { "CLEANUP_INTENT" }
        else if state == "CLEANUP_INTENT" && cleanup_kind && predicate == "STAGING_ABSENT" { "CLEANED" }
        else if state == "CLEANED" && predicate == "STAGING_ABSENT" { "CLEANED" }
        else { "OUTCOME_AMBIGUOUS" };
    Ok(json!({ "state": result }))
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
