import type { Interaction } from "@/types/contracts";
const TODO = (what: string): never => { throw new Error(`TODO: ${what}`); };

export const checkInteractions = (_generics: string[]): Interaction[] => TODO("checkInteractions");
