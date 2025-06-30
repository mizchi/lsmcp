import { subtract, sum } from "./math";

const result1 = sum(5, 3);
const result2 = subtract(10, 4);

console.log("Addition:", result1);
console.log("Subtraction:", result2);

// Use add in a callback
[1, 2, 3].reduce((acc, val) => sum(acc, val), 0);
