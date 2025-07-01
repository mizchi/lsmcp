// Test file with intentional errors for diagnostics testing

// Type error: String assigned to Int
let number_var : Int = "not a number"

// Undefined variable
fn use_undefined() -> Unit {
  println(undefined_variable)
}

// Type mismatch in function parameter
fn expect_string(s : String) -> Unit {
  println(s)
}

fn test_type_mismatch() -> Unit {
  expect_string(123) // Error: Int is not assignable to String
}

// Function missing return value
fn must_return_int() -> Int {
  println("forgot to return")
  // Missing return statement
}

// Incorrect array type
let number_array : Array[Int] = ["one", "two", "three"]

// Pattern matching not exhaustive
enum Color {
  Red
  Green
  Blue
}

fn incomplete_match(color : Color) -> Unit {
  match color {
    Red => println("Red")
    Green => println("Green")
    // Missing Blue case
  }
}

// Wrong number of arguments
fn takes_two_args(a : Int, b : Int) -> Int {
  a + b
}

fn test_wrong_args() -> Unit {
  let result = takes_two_args(1) // Error: missing argument
  println(result)
}

// Type inference error
fn type_inference_error() -> Unit {
  let x = 42
  let y : String = x // Error: Int cannot be assigned to String
  println(y)
}

// Invalid operator usage
fn invalid_operator() -> Unit {
  let a = "hello"
  let b = "world"
  let c = a - b // Error: operator - not defined for String
  println(c)
}