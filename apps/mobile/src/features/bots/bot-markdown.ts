export type InlineSpan =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "bold"; readonly text: string }
  | { readonly kind: "code"; readonly text: string };

export type MarkdownBlock =
  | { readonly kind: "heading"; readonly spans: InlineSpan[] }
  | { readonly kind: "paragraph"; readonly spans: InlineSpan[] }
  | { readonly kind: "bullet"; readonly marker: string; readonly spans: InlineSpan[] }
  | { readonly kind: "code"; readonly text: string };

/** Blocks and spans are positional, so their position in the source is their key. */
export function chatMarkdownKey(kind: string, index: number) {
  return `${kind}:${index}`;
}

/** Enough Markdown for chat bubbles; the full thread view keeps the rich renderer. */
export function parseChatMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", spans: parseInline(paragraph.join(" ")) });
      paragraph = [];
    }
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.trimStart().startsWith("```")) {
      flush();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]!.trimStart().startsWith("```")) {
        code.push(lines[index]!);
        index += 1;
      }
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", spans: parseInline(heading[1]!) });
      continue;
    }
    const bullet = /^\s*([-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      const marker = /\d/.test(bullet[1]!) ? bullet[1]!.replace(")", ".") : "•";
      blocks.push({ kind: "bullet", marker, spans: parseInline(bullet[2]!) });
      continue;
    }
    if (line.trim().length === 0) {
      flush();
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) spans.push({ kind: "text", text: text.slice(last, start) });
    const token = match[0];
    spans.push(
      token.startsWith("`")
        ? { kind: "code", text: token.slice(1, -1) }
        : { kind: "bold", text: token.slice(2, -2) },
    );
    last = start + token.length;
  }
  if (last < text.length) spans.push({ kind: "text", text: text.slice(last) });
  return spans;
}
