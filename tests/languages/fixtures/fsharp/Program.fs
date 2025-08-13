open System
open Types

[<EntryPoint>]
let main argv =
    let service = UserService()
    
    let users = [
        service.CreateUser(1, "Alice", Some "alice@example.com")
        service.CreateUser(2, "Bob", None)
        service.CreateUser(3, "Charlie", Some "charlie@example.com")
    ]
    
    users |> List.iter (fun user ->
        printfn "%s" (service.GreetUser(user))
    )
    
    // This should cause a type error
    let invalidUser = service.CreateUser("not-a-number", "Invalid", None) // Type error: string is not int
    
    // This will also cause a type error
    let result: int = service.GreetUser(users.[0]) // Type error: string is not int
    
    0 // return an integer exit code