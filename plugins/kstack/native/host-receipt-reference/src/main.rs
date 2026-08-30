use std::env;

fn bit(value: &str) -> Result<bool, ()> {
    match value { "0" => Ok(false), "1" => Ok(true), _ => Err(()) }
}

fn evaluate(line: &str) -> Result<&'static str, ()> {
    let fields: Vec<&str> = line.split(',').collect();
    if fields.len() != 9 { return Err(()); }
    let integrity = bit(fields[0])?; let revoked = bit(fields[1])?; let correlation = bit(fields[2])?;
    let contradictory = bit(fields[3])?; let unknown = bit(fields[4])?; let possibly_acted_missing = bit(fields[5])?;
    let mandatory = bit(fields[6])?; let channels = bit(fields[7])?;
    if !["PROVEN_DENIED", "PROVEN_FAILED", "PROVEN_SUCCEEDED"].contains(&fields[8]) { return Err(()); }
    if !integrity || revoked || !correlation { Ok("INVALID") }
    else if contradictory { Ok("CONTRADICTORY") }
    else if unknown || possibly_acted_missing { Ok("AMBIGUOUS") }
    else if !mandatory || !channels { Ok("UNAVAILABLE") }
    else { Ok(match fields[8] { "PROVEN_DENIED" => "PROVEN_DENIED", "PROVEN_FAILED" => "PROVEN_FAILED", _ => "PROVEN_SUCCEEDED" }) }
}

fn main() {
    let arguments: Vec<String> = env::args().collect();
    if arguments.len() != 2 || arguments[1].len() > 1_048_576 { std::process::exit(2); }
    let input = &arguments[1];
    let lines: Vec<&str> = input.lines().collect();
    if lines.is_empty() || lines.len() > 2_048 { std::process::exit(2); }
    let mut output = Vec::with_capacity(lines.len());
    for line in lines { match evaluate(line) { Ok(value) => output.push(value), Err(_) => std::process::exit(2) } }
    println!("{}", output.join("\n"));
}
