import { MoonbitProjectManager, MoonbitConfig } from "./src/utils/project";

// Test code completion and other features
const project = new MoonbitProjectManager("./moon.mod.json");

// Try to access methods
// @ts-ignore - Example code
const name = project.name;
// @ts-ignore - Example code
const version = project.version;

// Create a new config
const config: MoonbitConfig = {
  name: "example",
  version: "0.1.0",
};

// Use the config
console.log(`Config created: ${config.name} v${config.version}`);

// Test build function
// @ts-ignore - Example code
const buildResult = async () => {
  // build functionality example
};
