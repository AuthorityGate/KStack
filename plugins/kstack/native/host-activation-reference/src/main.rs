use std::env;

fn bit(value: &str) -> Result<bool, ()> { match value { "0" => Ok(false), "1" => Ok(true), _ => Err(()) } }

fn evaluate(line: &str) -> Result<&'static str, ()> {
    let fields: Vec<&str> = line.split(',').collect(); if fields.len() != 7 { return Err(()); }
    if !["CANDIDATE", "HISTORICAL", "OTHER", "PRIOR"].contains(&fields[0]) || !["ABSENT", "DURABLE", "INVALID"].contains(&fields[1]) { return Err(()); }
    let intent = bit(fields[2])?; let integrity = bit(fields[3])?; let lineage = bit(fields[4])?; let closure = bit(fields[5])?; let durability = bit(fields[6])?;
    if !integrity || !intent { Ok("ACTIVATION_AMBIGUOUS") }
    else if fields[0] == "PRIOR" && fields[1] == "ABSENT" { Ok("RECOVERED_PRIOR") }
    else if fields[0] == "CANDIDATE" && fields[1] == "DURABLE" && lineage && closure && durability { Ok("ACTIVE") }
    else { Ok("ACTIVATION_AMBIGUOUS") }
}

fn main() {
    let arguments: Vec<String> = env::args().collect(); if arguments.len() != 2 || arguments[1].len() > 1_048_576 { std::process::exit(2); }
    let lines: Vec<&str> = arguments[1].lines().collect(); if lines.is_empty() || lines.len() > 2_048 { std::process::exit(2); }
    let mut output = Vec::with_capacity(lines.len()); for line in lines { match evaluate(line) { Ok(value) => output.push(value), Err(_) => std::process::exit(2) } }
    println!("{}", output.join("\n"));
}
