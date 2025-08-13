pub fn fixed_function() -> String {
  let x : String = "hello"
  let y : Int = 42
  // Use string concatenation
  x + y.to_string()
}

pub fn another_fixed() -> String {
  // Convert Int to String
  "123"
}

pub fn fixed_variable() -> Unit {
  // Define variable before using
  let defined_var = "This is defined"
  println(defined_var)
}