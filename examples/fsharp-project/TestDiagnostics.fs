module TestDiagnostics

// Test file with intentional errors for diagnostics testing

// Type error: string assigned to int
let numberVar: int = "not a number"

// Undefined variable
let useUndefined () =
    printfn "%s" undefinedVariable

// Type mismatch in function parameter
let expectString (s: string) =
    printfn "%s" s

let testTypeMismatch () =
    expectString 123  // Error: int is not assignable to string

// Function missing return value
let mustReturnInt () : int =
    printfn "forgot to return"
    // Missing return expression

// Incorrect list type
let numberList: int list = ["one"; "two"; "three"]

// Pattern matching not exhaustive
type Color = 
    | Red
    | Green
    | Blue

let incompleteMatch color =
    match color with
    | Red -> printfn "Red"
    | Green -> printfn "Green"
    // Missing Blue case - Warning: incomplete pattern match

// Wrong number of arguments
let takesTwoArgs a b = a + b

let testWrongArgs () =
    let result = takesTwoArgs 1  // Error: missing argument
    printfn "%d" result

// Type inference error
let typeInferenceError () =
    let x = 42
    let y: string = x  // Error: int cannot be assigned to string
    printfn "%s" y

// Invalid operator usage
let invalidOperator () =
    let a = "hello"
    let b = "world"
    let c = a - b  // Error: operator - not defined for string
    printfn "%s" c

// Mutable variable used incorrectly
let mutableError () =
    let x = 10  // Immutable by default
    x <- 20     // Error: cannot assign to immutable value
    printfn "%d" x

// Recursive function without rec keyword
let factorial n =
    if n <= 1 then 1
    else n * factorial (n - 1)  // Error: factorial is not defined