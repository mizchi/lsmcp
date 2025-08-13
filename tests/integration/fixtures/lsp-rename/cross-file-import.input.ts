import { sharedFunction, sharedConstant } from "./cross-file-export.input";

const result = sharedFunction(10);
console.log(result + sharedConstant);
