struct User {
  id : Int
  name : String
  email : String?
}

fn greet_user(user : User) -> String {
  "Hello, \(user.name)!"
}

fn process_users(users : Array[User]) -> Map[String, Int] {
  let result = Map::new()
  for user in users {
    result[user.name] = user.id
  }
  result
}

fn main() {
  let users = [
    { id: 1, name: "Alice", email: Some("alice@example.com") },
    { id: 2, name: "Bob", email: None },
    { id: 3, name: "Charlie", email: Some("charlie@example.com") }
  ]
  
  let id_map = process_users(users)
  println("User ID map: \(id_map)")
  
  // This should cause a type error
  let invalid_id : String = 123 // Type error: Int is not String
  
  // This will also cause a type error
  let result : Int = process_users(users) // Type error: Map[String, Int] is not Int
}