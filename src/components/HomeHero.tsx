import { Image as ImageIcon, Lock, Sparkles } from 'lucide-react';

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
  return (
    <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-emerald-600 shadow-sm shadow-slate-200/40">
      <ImageIcon className="h-6 w-6" />
      <span className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
    </span>
  );
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

interface HomeHeroProps {
  onChooseFiles: () => void;
}

export function HomeCapabilityStrip() {
  return (
    <section aria-label="Workspace capabilities">
      <div className="grid gap-4 md:grid-cols-3">
        {capabilities.map(({ icon: Icon, title, description }) => (
          <article
            key={title}
            className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-200/60"
          >
            <div className="flex items-center gap-3">
              <Icon />
              <h2 className="text-base font-semibold text-slate-950">
                {title}
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function HomeHero({ onChooseFiles }: HomeHeroProps) {
  return (
    <header className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.82))] p-6 sm:p-8 lg:p-10">
      <div className="max-w-6xl">
        <div className="flex flex-col items-center gap-3 text-sm text-zinc-600 sm:flex-row sm:flex-wrap sm:justify-center sm:text-base">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-1.5">
            <Lock className="h-4 w-4 text-slate-500" />
            Local-first by default
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-1.5">
            <Sparkles className="h-4 w-4 text-slate-500" />
            AI only when configured
          </span>
        </div>

        <h1 className="mx-auto mt-6 max-w-full text-center text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl md:text-[1.45rem] md:leading-[1.12] md:whitespace-nowrap lg:text-[1.7rem] xl:text-[1.9rem] 2xl:text-[2.05rem]">
          PDF, Word, and Images in One Local-First Workspace
        </h1>

        <div className="mx-auto mt-5 max-w-[56rem] space-y-1 text-center text-base leading-8 text-zinc-600 sm:text-lg">
          <p className="md:text-[1rem] md:whitespace-nowrap">
            Drop mixed files, organize them visually, convert or extract what you need,{' '}
            <span className="whitespace-nowrap">and export the result.</span>
          </p>
          <p>LLM stays off until you configure a key.</p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onChooseFiles}
            className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Choose files
          </button>
          <p className="text-sm text-zinc-500">Open the file picker and continue in the same local-first workspace.</p>
        </div>

      </div>
    </header>
  );
}