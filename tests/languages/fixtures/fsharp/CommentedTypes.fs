module CommentedTypes

/// This is a document comment for the function
/// It spans multiple lines to test position handling
let myFunction x =
    x + 1

/// Another comment for a type
type MyType = {
    /// Field comment for Value
    Value: int
    /// Another field comment for Name
    Name: string
}

/// Comment for a class
type MyClass() =
    /// Method comment
    member this.GetValue() = 42
    
    /// Property comment  
    member this.Property = "test"

/// Record type with multiple commented fields
type Person = {
    /// The person's first name
    FirstName: string
    /// The person's last name
    LastName: string
    /// The person's age
    Age: int
    /// The person's email address
    Email: string option
}