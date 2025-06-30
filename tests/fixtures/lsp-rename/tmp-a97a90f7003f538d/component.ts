import { Configuration } from "./types";
import { ApiClient, createDefaultConfig } from "./api";

export class Component {
  private client: ApiClient;
  private config: Configuration;

  constructor(config?: Partial<Configuration>) {
    this.config = { ...createDefaultConfig(), ...config };
    this.client = new ApiClient(this.config);
  }

  getConfig(): Configuration {
    return this.config;
  }
}
