export function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");
}

const HONORIFIC_PREFIXES = [
  "dr",
  "mr",
  "mrs",
  "ms",
  "miss",
  "mx",
  "prof",
  "professor",
  "shri",
  "smt",
  "sir",
  "capt",
  "captain",
  "group captain",
  "wing commander",
  "colonel",
  "major",
  "lieutenant",
  "general",
  "er",
].sort((a, b) => b.length - a.length);

export function normalizeGuestName(value: string): string {
  // Split camelCase/concatenated names (e.g. "NikhilKamath" -> "Nikhil Kamath")
  // before lowercasing, so distinct words aren't merged into one token.
  const spaced = value.replace(/([a-z])([A-Z])/g, "$1 $2");
  let result = normalize(spaced);

  for (const prefix of HONORIFIC_PREFIXES) {
    const withSpace = `${prefix} `;
    if (result.startsWith(withSpace)) {
      result = result.slice(withSpace.length);
      break;
    }
  }

  return result.trim();
}
