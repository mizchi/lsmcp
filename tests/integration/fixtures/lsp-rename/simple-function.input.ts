function processData(data: string): string {
  return data.toUpperCase();
}

const result = processData("hello");
console.log(result);
console.log(processData("world"));
export { processData };
