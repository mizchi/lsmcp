package main

import (
	"fmt"
)

type User struct {
	ID    int
	Name  string
	Email *string
}

func NewUser(id int, name string, email *string) *User {
	return &User{
		ID:    id,
		Name:  name,
		Email: email,
	}
}

func (u *User) Greet() string {
	return fmt.Sprintf("Hello, I'm %s!", u.Name)
}

func processUsers(users []*User) map[string]int {
	result := make(map[string]int)
	for _, user := range users {
		result[user.Name] = user.ID
	}
	return result
}

func main() {
	email1 := "alice@example.com"
	email3 := "charlie@example.com"
	
	users := []*User{
		NewUser(1, "Alice", &email1),
		NewUser(2, "Bob", nil),
		NewUser(3, "Charlie", &email3),
	}

	idMap := processUsers(users)
	fmt.Printf("User ID map: %v\n", idMap)

	// This should cause a type error
	var invalidID string = 123 // Type error: cannot use 123 (untyped int constant) as string value

	// This will also cause a type error
	var result int = processUsers(users) // Type error: cannot use processUsers(users) (value of type map[string]int) as int value
	
	fmt.Println(invalidID, result)
}