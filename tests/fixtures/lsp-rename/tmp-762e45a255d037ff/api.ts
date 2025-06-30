import { ApiResponse, Config } from "./types";

export class ApiClient {
  constructor(private config: Config) {}

  async get<T>(path: string): Promise<ApiResponse<T>> {
    // Simulated API call
    return {
      data: {} as T,
      status: 200,
      config: this.config,
    };
  }

  updateConfig(newConfig: Partial<Config>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export function createDefaultConfig(): Config {
  return {
    apiUrl: "https://api.example.com",
    timeout: 5000,
    retries: 3,
  };
}
