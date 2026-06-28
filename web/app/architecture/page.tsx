import Link from "next/link";
import { Panel } from "@/components/Panel";
import {
  CanonicalTransformation,
  HighLevelArchitecture,
  IngestionPipeline,
  ReplayHarness,
  SilentNullDetection,
} from "@/components/architecture/diagrams";

export const metadata = { title: "Oximy — Architecture" };

export default function ArchitecturePage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <nav className="mb-7 flex items-center gap-4 border-b border-line pb-5">
        <Link href="/" className="nameplate text-xl text-text transition-colors hover:text-alive">
          OXIMY
        </Link>
        <nav className="hidden items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] sm:flex">
          <Link href="/" className="text-faint transition-colors hover:text-text">
            Signal Room
          </Link>
          <span className="text-alive">Architecture</span>
        </nav>
        <Link
          href="/"
          className="ml-auto rounded border border-line2 bg-raised px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:text-text"
        >
          ← back
        </Link>
      </nav>

      <header className="mb-8">
        <div className="eyebrow">How it works</div>
        <h1 className="nameplate mt-1 text-3xl text-text">ARCHITECTURE</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Every payload travels the same path: detect the shape, parse it with a versioned parser,
          normalize to one canonical event, dedupe on identity, and check for drift before it&apos;s
          stored. These diagrams trace that path and the two things that make it trustworthy — the
          replay harness and silent-null detection.
        </p>
      </header>

      <div className="space-y-6">
        <Panel eyebrow="Diagram 1" title="High-level architecture">
          <HighLevelArchitecture />
        </Panel>

        <Panel eyebrow="Diagram 2" title="Ingestion pipeline" right={<Flowing />}>
          <p className="mb-5 text-[13px] text-muted">A single payload flowing end to end.</p>
          <IngestionPipeline />
        </Panel>

        <Panel eyebrow="Diagram 3" title="Replay harness">
          <p className="mb-5 text-[13px] text-muted">
            Re-run every parser version over history and diff against the golden output — so a parser
            change can never silently break old data.
          </p>
          <ReplayHarness />
        </Panel>

        <Panel eyebrow="Diagram 4" title="Why silent-null is dangerous">
          <p className="mb-5 text-[13px] text-muted">
            The failure that doesn&apos;t throw. A field reports reliably, the provider moves it, and
            the parser keeps &quot;succeeding&quot; while the value reads null.
          </p>
          <SilentNullDetection />
        </Panel>

        <Panel eyebrow="Diagram 5" title="Canonical event transformation">
          <p className="mb-5 text-[13px] text-muted">
            Three different provider schemas, one unified structure.
          </p>
          <CanonicalTransformation />
        </Panel>
      </div>

      <footer className="mt-10 border-t border-line/60 pt-5 font-mono text-[11px] leading-relaxed text-faint">
        Diagrams are responsive HTML/CSS (no static images) so they stay sharp and dark-mode native.
      </footer>
    </main>
  );
}

function Flowing() {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px] text-faint">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-alive" /> live flow
    </span>
  );
}
