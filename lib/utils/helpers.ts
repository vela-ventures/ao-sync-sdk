/**
 * Decode a base64url encoded string to a Uint8Array
 */
export function base64UrlDecode(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const paddedBase64 = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const decodedString = atob(paddedBase64);
  const byteArray = new Uint8Array(decodedString.length);
  for (let i = 0; i < decodedString.length; i++) {
    byteArray[i] = decodedString.charCodeAt(i);
  }
  return byteArray;
}

/**
 * Compare two semantic version strings
 * @returns true if version >= minVersion
 */
export function isVersionValid(version: string, minVersion: string): boolean {
  const v1 = version.split(".").map(Number);
  const v2 = minVersion.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    if ((v1[i] || 0) > (v2[i] || 0)) return true;
    if ((v1[i] || 0) < (v2[i] || 0)) return false;
  }
  return true;
}
