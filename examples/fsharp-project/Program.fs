// For more information see https://aka.ms/fsharp-console-apps
module Program

let add x y = x + y
let multiply x y = x * y

// Type error test
let (_typeError: string) = 123 // Error: assigning int to string

let main() =
    printfn "=== F# Calculator Demo ==="
    
    // Basic calculations
    let addResult = Calculator.add 10 5
    let subResult = Calculator.subtract 10 5
    let mulResult = Calculator.multiply 10 5
    let divResult = Calculator.divide 10 5
    
    printfn "10 + 5 = %d" addResult
    printfn "10 - 5 = %d" subResult
    printfn "10 * 5 = %d" mulResult
    printfn "10 / 5 = %d" divResult
    
    // List sum
    let numbers = [1; 2; 3; 4; 5]
    let sum = Calculator.sumList numbers
    printfn "Sum of %A = %d" numbers sum
    
    // Pattern matching
    printfn "10 is %s" (Calculator.describeNumber 10)
    printfn "-5 is %s" (Calculator.describeNumber -5)
    printfn "0 is %s" (Calculator.describeNumber 0)
    
    0

main() |> ignore
