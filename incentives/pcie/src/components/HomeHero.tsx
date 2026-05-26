import { Download, FileText, Files, Image as ImageIcon, Lock, ScanText, Sparkles, Wand2 } from 'lucide-react';

const heroHighlights = [
  {
    icon: Files,
    title: 'Unified intake',
    description: 'Drop in PDFs, images, and Word files.',
    accentClass: 'bg-sky-50 text-sky-700 border-sky-100',
  },
  {
    icon: FileText,
    title: 'Edit and convert',
    description: 'Merge, split, compress, and convert.',
    accentClass: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  {
    icon: Wand2,
    title: 'Enhance and read',
    description: 'Upscale images. Preview fast. Pull text.',
    accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  {
    icon: Download,
    title: 'Review and export',
    description: 'Review results, ask AI, export ZIPs.',
    accentClass: 'bg-rose-50 text-rose-700 border-rose-100',
  },
];

const trustSignals = [
  {
    icon: Lock,
    title: 'Local-first processing',
    description: 'Editing and export stay in-browser by default.',
  },
  {
    icon: Sparkles,
    title: 'Gemini when you choose it',
    description: 'AI stays off until you add a key.',
  },
];

export default function HomeHero() {
  return (
    <header className="mb-10">
      <div className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_32px_80px_-48px_rgba(15,23,42,0.35)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.35),transparent_34%),radial-gradient(circle_at_top_right,rgba(167,243,208,0.28),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]" />
        <div className="absolute -top-16 right-0 h-40 w-40 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute -bottom-20 left-12 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl" />

        <div className="relative px-6 py-8 md:px-10 md:py-10">
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            <span className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1">Local-first workspace</span>
            <span className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1">PDF · Image · Word</span>
            <span className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1">AI optional</span>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_0.95fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50/90 px-3 py-1 text-sm font-medium text-sky-700">
                <ImageIcon className="h-4 w-4" />
                Sort. Convert. Extract. Export.
              </div>

              <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 md:text-5xl md:leading-[1.05]">
                One workspace for PDFs, images, and Word.
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-600 md:text-lg">
                Drop in mixed files. Reorder fast. Turn images and Word into PDF. Merge, compress, extract, enhance, then export.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {trustSignals.map(({ icon: Icon, title, description }) => (
                  <div key={title} className="rounded-2xl border border-zinc-200/80 bg-white/80 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-3 text-zinc-900">
                      <div className="rounded-xl bg-zinc-100 p-2">
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold">{title}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {heroHighlights.map(({ icon: Icon, title, description, accentClass }) => (
                <div key={title} className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 backdrop-blur-sm">
                  <div className={`inline-flex rounded-2xl border px-3 py-2 ${accentClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-zinc-900">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}