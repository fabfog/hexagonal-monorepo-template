import ky, { type KyInstance } from "ky";

export type { KyInstance };

export interface CreateHttpClientOptions {
  prefixUrl?: string;
  headers?: Record<string, string>;
}

export function createHttpClient(options?: CreateHttpClientOptions): KyInstance {
  return ky.create(options ?? {});
}
