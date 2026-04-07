import type DataLoader from "dataloader";

import type { DataLoaderRegistry } from "./create-data-loader-registry";

export interface IdleDataLoaderHandle<K, V, _C = K> {
  load: (key: K) => Promise<V>;
  clearCache: () => void;
}

export function createIdleDataLoader<K, V, C = K>(options: {
  registry: DataLoaderRegistry;
  loaderKey: string;
  factory: () => DataLoader<K, V, C>;
  idleMs?: number | undefined;
}): IdleDataLoaderHandle<K, V, C> {
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const getLoader = (): DataLoader<K, V, C> =>
    options.registry.getOrCreate(options.loaderKey, options.factory);

  const clearCache = (): void => {
    getLoader().clearAll();
  };

  const scheduleIdleClear = (): void => {
    const ms = options.idleMs;
    if (ms === undefined || ms <= 0) {
      return;
    }

    if (idleTimer !== undefined) {
      clearTimeout(idleTimer);
    }

    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      clearCache();
    }, ms);
  };

  return {
    load(key: K) {
      scheduleIdleClear();
      return getLoader().load(key);
    },
    clearCache,
  };
}
