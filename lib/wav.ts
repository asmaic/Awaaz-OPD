/** Wrap raw 16-bit little-endian PCM (default 24 kHz mono) in a 44-byte WAV header. */
export function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1): Buffer {
  const h = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); // fmt chunk size
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(channels * 2, 32); // block align
  h.writeUInt16LE(16, 34); // bits per sample
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Gemini TTS returns either a WAV (starts with "RIFF") or raw PCM ("audio/L16;rate=24000"). */
export function ensureWav(audio: Buffer, mime = ""): Buffer {
  if (audio.subarray(0, 4).toString("ascii") === "RIFF") return audio;
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
  return pcmToWav(audio, rate);
}
