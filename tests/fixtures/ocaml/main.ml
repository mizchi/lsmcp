(* Type definitions *)
type user = {
  name: string;
  age: int;
  email: string option;
}

(* Functions *)
let greet_user user =
  "Hello, " ^ user.name ^ "!"

let process_users users =
  List.map (fun u -> (u.name, u.age)) users

(* Example with type error *)
let invalid_age = 
  { name = "Alice"; age = "not a number"; email = None }  (* Type error: string instead of int *)

(* Another type error *)
let wrong_type : int = "hello"  (* Type error: string instead of int *)

(* Main *)
let () =
  let users = [
    { name = "Alice"; age = 30; email = Some "alice@example.com" };
    { name = "Bob"; age = 25; email = None };
    { name = "Charlie"; age = 35; email = Some "charlie@example.com" };
  ] in
  let user_list = process_users users in
  Printf.printf "User list: %s\n" (String.concat ", " (List.map (fun (n, a) -> Printf.sprintf "(%s, %d)" n a) user_list));
  print_endline (greet_user (List.hd users))