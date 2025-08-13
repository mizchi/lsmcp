module TestModule

/// This is a document comment for the function
/// It spans multiple lines to test position handling
let myFunction x =
    x + 1

/// Another comment for a type
type MyType = {
    /// Field comment
    Value: int
    /// Another field comment
    Name: string
}

/// Comment for a class
type MyClass() =
    /// Method comment
    member this.GetValue() = 42
    
    /// Property comment
    member this.Property = "test"