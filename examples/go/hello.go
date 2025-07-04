package main

import (
	"fmt"
	"strings"
)

// Person represents a person with a name and age
type Person struct {
	Name string
	Age  int
}

// NewPerson creates a new Person instance
func NewPerson(name string, age int) *Person {
	return &Person{
		Name: name,
		Age:  age,
	}
}

// Greet returns a greeting message
func (p *Person) Greet() string {
	return fmt.Sprintf("Hello, my name is %s and I am %d years old", p.Name, p.Age)
}

// Helper functions
func formatName(name string) string {
	return strings.Title(strings.ToLower(name))
}

func main() {
	person := NewPerson("Alice", 30)
	fmt.Println(person.Greet())
	
	// Example of using the helper function
	formattedName := formatName("JOHN DOE")
	fmt.Println("Formatted name:", formattedName)
}