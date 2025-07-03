module Types

type User = {
    Id: int
    Name: string
    Email: string option
}

type UserService() =
    member this.CreateUser(id: int, name: string, email: string option) =
        { Id = id; Name = name; Email = email }
    
    member this.GreetUser(user: User) =
        sprintf "Hello, %s!" user.Name