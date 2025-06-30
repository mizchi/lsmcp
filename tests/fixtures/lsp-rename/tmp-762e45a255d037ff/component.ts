import { Config } from "./types";
import { ApiClient, createDefaultConfig } from "./api";

export class Component {
  private client: ApiClient;
  private config: Config;

  constructor(config?: Partial<Config>) {
    this.config = { ...createDefaultConfig(), ...config };
    this.client = new ApiClient(this.config);
  }

  getConfig(): Config {
    return this.config;
  }
}
