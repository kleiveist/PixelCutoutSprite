use std::env;
use std::path::PathBuf;
use std::process::ExitCode;

use pixel_cutout_sprite_studio_lib::application::ExampleVaultService;

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("error: {message}");
            ExitCode::FAILURE
        }
    }
}

fn run() -> Result<(), String> {
    let mut arguments = env::args_os().skip(1);
    let Some(flag) = arguments.next() else {
        return Err(usage());
    };
    if flag == "--help" || flag == "-h" {
        println!("{}", usage());
        return Ok(());
    }
    if flag != "--output" {
        return Err(usage());
    }
    let output = arguments.next().map(PathBuf::from).ok_or_else(usage)?;
    if arguments.next().is_some() {
        return Err(usage());
    }

    let outcome = ExampleVaultService::generate(&output).map_err(|error| error.to_string())?;
    println!(
        "{}",
        serde_json::to_string_pretty(&outcome).map_err(|error| error.to_string())?
    );
    Ok(())
}

fn usage() -> String {
    "usage: cargo run --manifest-path src-tauri/Cargo.toml --example generate_lichterhain -- --output <EMPTY_DIRECTORY>".to_owned()
}
