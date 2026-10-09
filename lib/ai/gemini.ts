import type { Extraction, RxItem, RxRead } from "@/types/contracts";
const TODO = (what: string): never => { throw new Error(`TODO: ${what}`); };

export class ScriptError extends Error {}
export const extractFromAudio = async (_b64: string, _mime: string, _model?: string): Promise<Extraction> => TODO("extractFromAudio");
export const extractFromText = async (_text: string, _model?: string): Promise<Extraction> => TODO("extractFromText");
export const readPrescription = async (_b64: string, _mime: string): Promise<RxRead> => TODO("readPrescription");
export const urduInstructions = async (_items: RxItem[]): Promise<string> => TODO("urduInstructions");
/** Returns the public URL of the generated WAV, e.g. /generated/<hash>.wav */
export const tts = async (_text: string, _voice?: string): Promise<string> => TODO("tts");
