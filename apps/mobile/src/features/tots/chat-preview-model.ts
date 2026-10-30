/** Longest preview kept; the row cuts it to one line anyway. */
const PREVIEW_LIMIT = 240;

/** A message as one plain line for a chat row: markdown marks removed, whitespace collapsed. */
export function cleanPreviewText(text: string): string {
  const plain = text
    // Fenced code keeps its body; the fences and language tag go.
    .replace(/```[^\n]*\n?([\s\S]*?)(?:```|$)/g, (_, body: string) => ` ${body} `)
    .replace(/~~~[^\n]*\n?([\s\S]*?)(?:~~~|$)/g, (_, body: string) => ` ${body} `)
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*(?:>\s?)+/, "")
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, "")
        .replace(/^\s*(?:[-*_]\s*){3,}$/, ""),
    )
    .join(" ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<(https?:\/\/[^>\s]+)>/g, "$1")
    .replace(/`+([^`]*)`+/g, "$1")
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2")
    .replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*(?!\w)/g, "$1$2")
    .replace(/(^|[^\w_])_(?=\S)([^_]*?\S)_(?!\w)/g, "$1$2")
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > PREVIEW_LIMIT ? `${plain.slice(0, PREVIEW_LIMIT - 3).trimEnd()}...` : plain;
}
