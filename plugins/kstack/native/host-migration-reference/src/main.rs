use std::env;

fn bit(value: &str) -> Result<bool, ()> { match value { "0" => Ok(false), "1" => Ok(true), _ => Err(()) } }

fn classify(line: &str) -> Result<&'static str, ()> {
    let fields: Vec<&str> = line.split(',').collect(); if fields.len() != 10 { return Err(()); }
    let bits: Result<Vec<bool>, ()> = fields.iter().map(|value| bit(value)).collect(); let values = bits?;
    let artifact = values[0]; let complete = values[1]; let current = values[2]; let supported = values[3]; let qualified = values[4]; let bound = values[5]; let available = values[6]; let zero = values[7]; let strategy = values[8]; let operational = values[9];
    if !complete || !current || !supported || !qualified || !bound { Ok("BLOCKED_EVIDENCE") }
    else if artifact && (!available || !zero || !strategy) { Ok("BLOCKED_ZERO_LOSS") }
    else if !artifact && !operational { Ok("ROLLBACK_UNAVAILABLE") }
    else { Ok("ACTIVATION_READY") }
}

fn main() {
    let arguments: Vec<String> = env::args().collect(); if arguments.len() != 2 || arguments[1].len() > 1_048_576 { std::process::exit(2); }
    let lines: Vec<&str> = arguments[1].lines().collect(); if lines.is_empty() || lines.len() > 2_048 { std::process::exit(2); }
    let mut output = Vec::with_capacity(lines.len()); for line in lines { match classify(line) { Ok(value) => output.push(value), Err(_) => std::process::exit(2) } } println!("{}", output.join("\n"));
}
