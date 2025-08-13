module Calculator

// Basic arithmetic operations
let add x y = x + y
let subtract x y = x - y
let multiply x y = x * y
let divide x y = 
    if y = 0 then 
        failwith "Division by zero"
    else 
        x / y

// Higher-order function example
let applyOperation op x y = op x y

// Record type
type CalculationResult = {
    Operation: string
    Result: int
}

// Execute calculation and return result
let calculate opName x y =
    let result = 
        match opName with
        | "add" -> add x y
        | "subtract" -> subtract x y
        | "multiply" -> multiply x y
        | "divide" -> divide x y
        | _ -> failwith "Unknown operation"
    { Operation = opName; Result = result }

// Pattern matching example
let describeNumber n =
    match n with
    | 0 -> "Zero"
    | n when n > 0 -> "Positive"
    | _ -> "Negative"

// List operations
let sumList numbers =
    List.fold (+) 0 numbers

// Code with errors (for testing)
let buggyFunction x =
    let y = unknownVariable // Error: unknownVariable is not defined
    x + y

// Type error test
let typeError: string = 123 // Error: assigning int to string