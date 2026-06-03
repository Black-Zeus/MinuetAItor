const OMITTED_ABBREVIATION_WORDS = new Set([
  "a",
  "al",
  "da",
  "das",
  "de",
  "del",
  "do",
  "dos",
  "e",
  "el",
  "la",
  "las",
  "lo",
  "los",
  "y",
]);

const normalizeWord = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const deriveParticipantAbbreviation = (fullName = "") => {
  const words = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean)
    .filter((word) => !OMITTED_ABBREVIATION_WORDS.has(normalizeWord(word)));

  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return "";
};
