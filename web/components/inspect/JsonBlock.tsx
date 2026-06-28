"use client";

import { useState } from "react";
import { tokenizeJson } from "@/lib/highlight";

export function JsonBlock({ value, maxHeight = 360 }: { value: unknown; maxHeight?: number }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(value, null, 2);
  const toks = tokenizeJson(json);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  return (
    <div className="relative">
      <button
        onClick={copy}
        className="absolute right-2 top-2 z-10 rounded border border-line2 bg-ink/90 px-2 py-1 font-mono text-[10px] text-muted transition-colors hover:text-alive"
      >
        {copied ? "copied" : "copy"}
      </button>
      <pre
        className="overflow-auto rounded-md border border-line bg-ink/70 p-4 font-mono text-[12.5px] leading-relaxed"
        style={{ maxHeight }}
      >
        <code>
          {toks.map((t, i) => (
            <span key={i} className={t.cls}>
              {t.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
