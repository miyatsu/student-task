import { Lock, Sparkles } from 'lucide-react';

function DocumentGlyph({ label, toneClass }: { label: string; toneClass: string }) {
  return (
    <span className="relative inline-flex h-12 w-10 shrink-0 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
      <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-bl-lg border-b border-l border-slate-200 bg-slate-50" />
      <span className={`absolute inset-x-1.5 bottom-1.5 inline-flex items-center justify-center rounded-md px-1.5 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.18em] ${toneClass}`}>
        {label}
      </span>
    </span>
  );
}

function PdfDocumentGlyph() {
  return <DocumentGlyph label="PDF" toneClass="bg-rose-50 text-rose-700" />;
}

function WordDocumentGlyph() {
  return <DocumentGlyph label="DOC" toneClass="bg-sky-50 text-sky-700" />;
}

function ImageFileGlyph() {
  return <DocumentGlyph label="IMG" toneClass="bg-emerald-50 text-emerald-700" />;
}

const capabilities = [
  {
    icon: PdfDocumentGlyph,
    title: 'PDF Workflow',
    description: 'Merge, split, compress, extract pages, and export clean results.',
  },
  {
    icon: ImageFileGlyph,
    title: 'Image Workflow',
    description: 'Rotate, enhance, convert to PDF, or extract text when AI is enabled.',
  },
  {
    icon: WordDocumentGlyph,
    title: 'Word Workflow',
    description: 'Convert DOCX in-browser and handle legacy DOC through the local server path.',
  },
];

export function HomeCapabilityStrip() {
  return (
    <section aria-label="Workspace capabilities">
      <div className="overflow-hidden rounded-[1.8rem] border border-[color:var(--home-ribbon-border)] bg-[var(--home-ribbon-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <div className="grid divide-y divide-[color:var(--home-ribbon-border)] md:grid-cols-3 md:divide-x md:divide-y-0">
        {capabilities.map(({ icon: Icon, title, description }) => (
          <article
            key={title}
            className="flex items-start gap-4 px-5 py-5 sm:px-6"
          >
            <div className="shrink-0 pt-0.5">
              <Icon />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-950">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
            </div>
          </article>
        ))}
        </div>
      </div>
    </section>
  );
}

export default function HomeHero() {
  return (
    <header className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top,rgba(233,223,209,0.7),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(250,247,242,0.9))] px-5 py-6 shadow-[var(--home-soft-shadow)] sm:px-7 sm:py-8 lg:px-8 lg:py-9">
      <div className="mx-auto max-w-[82rem]">
        <div className="flex flex-col items-center gap-3 text-sm text-zinc-600 sm:flex-row sm:flex-wrap sm:justify-center sm:text-base">
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1.5 shadow-sm shadow-white/80">
            <Lock className="h-4 w-4 text-zinc-500" />
            Local-first by default
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1.5 shadow-sm shadow-white/80">
            <Sparkles className="h-4 w-4 text-zinc-500" />
            AI only when configured
          </span>
        </div>

        <h1 className="mx-auto mt-6 max-w-full text-center text-[clamp(1.8rem,3vw,2.5rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-[color:var(--home-title)] sm:whitespace-nowrap">
          PDF, Word, and Images in One Local-First Workspace
        </h1>

        <div className="mx-auto mt-5 max-w-[72rem] space-y-2 text-center text-[clamp(1rem,1.05vw,1.06rem)] leading-8 text-zinc-600">
          <p className="sm:whitespace-nowrap">
            Drop mixed files, organize them visually, convert or extract what you need,{' '}
            <span className="whitespace-nowrap">and export the result.</span>
          </p>
          <p className="sm:whitespace-nowrap">LLM stays off until you configure a key.</p>
        </div>

      </div>
    </header>
  );
}