const TODO = (what: string): never => { throw new Error(`TODO: ${what}`); };

export const cacheKey = (_parts: (string | Uint8Array)[]): string => TODO("cacheKey");
export const cacheGet = async <T>(_key: string): Promise<T | null> => TODO("cacheGet");
export const cacheSet = async (_key: string, _value: unknown): Promise<void> => TODO("cacheSet");
