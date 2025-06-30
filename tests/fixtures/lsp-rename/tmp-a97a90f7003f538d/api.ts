import { ApiResponse, Configuration } from "./types";

export class ApiClient {
  constructor(private config: Configuration) {}

  async get<T>(path: string): Promise<ApiResponse<T>> {
    // Simulated API call
    return {
      data: {} as T,
      status: 200,
      config: this.config,
    };
  }

  updateConfig(newConfig: Partial<Configuration>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export function createDefaultConfig(): Configuration {
  return {
    apiUrl: "https://api.example.com",
    timeout: 5000,
    retries: 3,
  };
}
