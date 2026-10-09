const TODO = (what: string): never => { throw new Error(`TODO: ${what}`); };

export const matchBrand = (_raw: string): { brand: string; generic: string } | null => TODO("matchBrand");
