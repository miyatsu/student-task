import { FileArchive, FileText, Image as ImageIcon, Lock, Sparkles } from 'lucide-react';

const capabilities = [
  {
    icon: FileText,
    title: 'PDF workflow',
    description: 'Merge, split, compress, extract pages, and export clean results.',
  },
  {
    icon: ImageIcon,
    title: 'Image workflow',
    description: 'Rotate, enhance, convert to PDF, or extract text when AI is enabled.',
  },
  {
    icon: FileArchive,
    title: 'Word workflow',
    description: 'Convert DOCX in-browser and handle legacy DOC through the local server path.',
  },
];

interface HomeHeroProps {
  onChooseFiles: () => void;
}

export function HomeCapabilityStrip() {
  return (
    <section aria-labelledby="workspace-capabilities" className="mt-6">
      <div className="grid gap-4 md:grid-cols-3">
        {capabilities.map(({ icon: Icon, title, description }) => (
          <article
            key={title}
            className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-200/60"
          >
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
            <h2 id={title === 'PDF workflow' ? 'workspace-capabilities' : undefined} className="mt-4 text-base font-semibold text-slate-950">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function HomeHero({ onChooseFiles }: HomeHeroProps) {
  return (
    <header className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.82))] p-6 sm:p-8 lg:p-10">
      <div className="max-w-3xl">
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm shadow-slate-200/50">
          Local-first · AI optional
        </span>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.05]">
          Process PDFs, images, and Word files in one local-first workspace.
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
          Drop mixed files, organize them visually, convert or extract what you need, and export the result. Gemini stays off until you configure a key.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onChooseFiles}
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
          >
            Choose files
          </button>
          <p className="text-sm text-slate-600">Supports PDF · DOCX · DOC · PNG · JPG</p>
        </div>

        <div className="mt-8 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-1.5">
            <Lock className="h-4 w-4 text-slate-500" />
            Local-first by default
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-1.5">
            <Sparkles className="h-4 w-4 text-slate-500" />
            AI only when configured
          </span>
        </div>
      </div>
    </header>
  );
}