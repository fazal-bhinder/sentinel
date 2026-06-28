export type Tok = { text: string; cls: string };

// Pure JSON tokenizer → colored spans. Shared by the inspector's JsonBlock and
// the architecture diagrams so highlighting stays consistent.
export function tokenizeJson(src: string): Tok[] {
  const re = /("(?:\\.|[^"\\])*"(\s*:)?)|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  const out: Tok[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ text: src.slice(last, m.index), cls: "text-muted" });
    const t = m[0];
    let cls = "text-text";
    if (m[1]) cls = m[2] ? "text-alive" : "text-[#9DE5FF]"; // key vs string
    else if (m[3]) cls = t === "null" ? "text-dark font-semibold" : "text-warn"; // null/bool
    else if (m[4]) cls = "text-[#E6B5FF]"; // number
    out.push({ text: t, cls });
    last = m.index + t.length;
  }
  if (last < src.length) out.push({ text: src.slice(last), cls: "text-muted" });
  return out;
}
