import type { Extraction } from "@/types/contracts";
const TODO = (what: string): never => { throw new Error(`TODO: ${what}`); };

export const groqTranscribe = async (_buf: Buffer, _mime: string): Promise<string> => TODO("groqTranscribe");
export const groqExtract = async (_text: string): Promise<Extraction> => TODO("groqExtract");
