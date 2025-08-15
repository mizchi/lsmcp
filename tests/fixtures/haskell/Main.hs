module Main where

-- Type definitions
data User = User
    { userName :: String
    , userAge :: Int
    , userEmail :: Maybe String
    } deriving (Show, Eq)

-- Functions
greetUser :: User -> String
greetUser user = "Hello, " ++ userName user ++ "!"

processUsers :: [User] -> [(String, Int)]
processUsers users = map (\u -> (userName u, userAge u)) users

-- Example with type error
invalidAge :: User
invalidAge = User "Alice" "not a number" Nothing  -- Type error: String instead of Int

-- Another type error
wrongType :: Int
wrongType = "hello"  -- Type error: String instead of Int

-- Main function
main :: IO ()
main = do
    let users = [ User "Alice" 30 (Just "alice@example.com")
                , User "Bob" 25 Nothing
                , User "Charlie" 35 (Just "charlie@example.com")
                ]
    putStrLn $ "User list: " ++ show (processUsers users)
    putStrLn $ greetUser (head users)