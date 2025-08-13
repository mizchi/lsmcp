function handleData(data: string): string {
  return data.toUpperCase();
}

const result = handleData("hello");
console.log(result);
console.log(handleData("world"));
export { handleData };
