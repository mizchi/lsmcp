use std::collections::HashMap;

#[derive(Debug)]
struct User {
    id: u32,
    name: String,
    email: Option<String>,
}

impl User {
    fn new(id: u32, name: String, email: Option<String>) -> Self {
        User { id, name, email }
    }

    fn greet(&self) -> String {
        format!("Hello, I'm {}!", self.name)
    }
}

fn process_users(users: Vec<User>) -> HashMap<String, u32> {
    let mut result = HashMap::new();
    for user in users {
        result.insert(user.name.clone(), user.id);
    }
    result
}

fn main() {
    let users = vec![
        User::new(1, "Alice".to_string(), Some("alice@example.com".to_string())),
        User::new(2, "Bob".to_string(), None),
        User::new(3, "Charlie".to_string(), Some("charlie@example.com".to_string())),
    ];

    let id_map = process_users(users);
    println!("User ID map: {:?}", id_map);

    // This should cause a type error
    let invalid_id: String = 123; // Type error: expected String, found integer
    
    // This will also cause a type error  
    let result: i32 = process_users(vec![]); // Type error: expected i32, found HashMap
}