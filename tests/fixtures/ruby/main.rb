# Ruby test fixture for LSMCP

module Greeting
  def self.say_hello(name)
    "Hello, #{name}!"
  end
end

class Person
  attr_reader :name, :age

  def initialize(name, age)
    @name = name
    @age = age
  end

  def greet
    Greeting.say_hello(@name)
  end

  def adult?
    @age >= 18
  end
end

def main
  person = Person.new("Alice", 25)
  puts person.greet
end

if __FILE__ == $0
  main
end