import { processData, validateData } from "./lib";

function main() {
  const input = "hello world";

  if (validateData(input)) {
    const result = processData(input);
    console.log("Processed:", result);
  }
}

main();
