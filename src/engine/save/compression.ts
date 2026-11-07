/**
 * Gzip for save files, using the browser's (and Node's) built-in streams. Saves are large JSON documents
 * with a lot of repetition, so compression typically makes them around ten times smaller.
 */

const GZIP_MAGIC = [0x1f, 0x8b];

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(data as unknown as BufferSource);
  void writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export function compressText(text: string): Promise<Uint8Array> {
  return pipe(new TextEncoder().encode(text), new CompressionStream("gzip"));
}

/** Reads a save file's text, transparently un-gzipping it (plain .json saves from older builds still load). */
export async function readSaveText(bytes: Uint8Array): Promise<string> {
  const isGzip = bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1];
  return new TextDecoder().decode(isGzip ? await pipe(bytes, new DecompressionStream("gzip")) : bytes);
}
