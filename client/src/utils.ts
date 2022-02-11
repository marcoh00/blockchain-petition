/*
 * `digestMessageToArray` and `bufferToHexString` from Mozilla MDN:
 * https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
 */

export async function digestMessageToArray(message: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return hash;
  }


export function bufferToHexString(buffer: ArrayBuffer) {
    const hashArray = Array.from(new Uint8Array(buffer));                     // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
  }