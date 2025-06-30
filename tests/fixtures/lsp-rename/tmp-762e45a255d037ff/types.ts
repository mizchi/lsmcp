export interface Config {
  apiUrl: string;
  timeout: number;
  retries: number;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  config: Config;
}
