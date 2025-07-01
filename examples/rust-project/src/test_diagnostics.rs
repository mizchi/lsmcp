// Test file with intentional errors for diagnostics testing

// Unused import
use std::collections::HashMap;

// Function with wrong return type
fn add_numbers(a: i32, b: i32) -> String {
    a + b  // Error: expected String, found i32
}

// Undefined variable
fn use_undefined() {
    println!("{}", undefined_var);
}

// Type mismatch
fn type_mismatch() {
    let x: i32 = "not a number";  // Error: expected i32, found &str
}

// Borrowing error
fn borrowing_error() {
    let s = String::from("hello");
    let r1 = &s;
    let r2 = &mut s;  // Error: cannot borrow as mutable
    println!("{} {}", r1, r2);
}

// Missing lifetime specifier
fn lifetime_error(s: &str) -> &str {
    &s[..]  // Error: missing lifetime specifier
}

// Unused variable
fn unused_variable() {
    let unused = 42;  // Warning: unused variable
}

// Unreachable code
fn unreachable_code() -> i32 {
    return 42;
    println!("This is unreachable");  // Warning: unreachable code
}

// Match not exhaustive
enum Color {
    Red,
    Green,
    Blue,
}

fn incomplete_match(color: Color) {
    match color {
        Color::Red => println!("Red"),
        Color::Green => println!("Green"),
        // Missing Blue case - Error: non-exhaustive patterns
    }
}

// Infinite loop without break
fn infinite_loop() {
    loop {
        println!("This loops forever");
        // Missing break
    }
}

// Using moved value
fn use_after_move() {
    let s = String::from("hello");
    let s2 = s;  // s is moved here
    println!("{}", s);  // Error: use of moved value
}