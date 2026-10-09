const TODO = (what: string): never => { throw new Error(`TODO: ${what}`); };

/** Wrap raw 16-bit PCM (default 24 kHz mono) in a WAV header. */
export const pcmToWav = (_pcm: Buffer, _sampleRate = 24000, _channels = 1): Buffer => TODO("pcmToWav");
