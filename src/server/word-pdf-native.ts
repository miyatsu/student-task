import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type NativeWordPdfBackend = 'word-com' | 'libreoffice';

export interface ResolvedNativeWordPdfBackend {
  kind: NativeWordPdfBackend;
  executablePath?: string;
}

export class NativeWordPdfUnavailableError extends Error {
  code = 'native-backend-unavailable' as const;

  constructor(message = buildNativeWordPdfUnavailableMessage()) {
    super(message);
    this.name = 'NativeWordPdfUnavailableError';
  }
}

interface ResolveNativeWordPdfBackendDependencies {
  platform?: NodeJS.Platform;
  checkWordComAvailability?: () => Promise<boolean>;
  findLibreOfficeExecutable?: () => Promise<string | null>;
}

interface ConvertWordDocumentToPdfDependencies extends ResolveNativeWordPdfBackendDependencies {
  resolveNativeBackend?: () => Promise<ResolvedNativeWordPdfBackend | null>;
  runWordComExport?: (inputPath: string, outputPath: string) => Promise<void>;
  runLibreOfficeExport?: (executablePath: string, inputPath: string, outputPath: string) => Promise<void>;
  pathExists?: (targetPath: string) => boolean;
}

export function buildNativeWordPdfUnavailableMessage() {
  return 'No local high-fidelity Word-to-PDF backend is available. Install Microsoft Word or LibreOffice to enable native export.';
}

export function formatNativeWordPdfBackendLabel(backend: NativeWordPdfBackend) {
  return backend === 'word-com' ? 'local Microsoft Word' : 'local LibreOffice';
}

export function getPossibleLibreOfficeExecutables(environment: NodeJS.ProcessEnv = process.env) {
  const programFiles = environment.ProgramFiles ?? '';
  const programFilesX86 = environment['ProgramFiles(x86)'] ?? '';
  const localAppData = environment.LOCALAPPDATA ?? '';

  return [
    path.join(programFiles, 'LibreOffice', 'program', 'soffice.exe'),
    path.join(programFilesX86, 'LibreOffice', 'program', 'soffice.exe'),
    path.join(localAppData, 'Programs', 'LibreOffice', 'program', 'soffice.exe'),
    '/usr/bin/soffice',
    '/usr/local/bin/soffice',
  ].filter(Boolean);
}

export function resolveExistingExecutablePath(
  candidates: string[],
  pathExists: (targetPath: string) => boolean = (targetPath) => fs.existsSync(targetPath),
) {
  return candidates.find((candidate) => pathExists(candidate)) ?? null;
}

export async function resolveNativeWordPdfBackend(
  dependencies: ResolveNativeWordPdfBackendDependencies = {},
): Promise<ResolvedNativeWordPdfBackend | null> {
  const platform = dependencies.platform ?? process.platform;
  const checkWordComAvailability = dependencies.checkWordComAvailability ?? defaultCheckWordComAvailability;
  const findLibreOfficeExecutable = dependencies.findLibreOfficeExecutable ?? defaultFindLibreOfficeExecutable;

  if (platform === 'win32' && await checkWordComAvailability()) {
    return { kind: 'word-com' };
  }

  const executablePath = await findLibreOfficeExecutable();
  if (executablePath) {
    return {
      kind: 'libreoffice',
      executablePath,
    };
  }

  return null;
}

export async function convertWordDocumentToPdf(
  inputPath: string,
  outputPath: string,
  dependencies: ConvertWordDocumentToPdfDependencies = {},
): Promise<NativeWordPdfBackend> {
  const resolveNativeBackend = dependencies.resolveNativeBackend
    ?? (() => resolveNativeWordPdfBackend(dependencies));
  const runWordComExport = dependencies.runWordComExport ?? defaultRunWordComExport;
  const runLibreOfficeExport = dependencies.runLibreOfficeExport ?? defaultRunLibreOfficeExport;
  const pathExists = dependencies.pathExists ?? ((targetPath: string) => fs.existsSync(targetPath));

  const backend = await resolveNativeBackend();
  if (!backend) {
    throw new NativeWordPdfUnavailableError();
  }

  if (backend.kind === 'word-com') {
    await runWordComExport(inputPath, outputPath);
  } else {
    await runLibreOfficeExport(backend.executablePath!, inputPath, outputPath);
  }

  if (!pathExists(outputPath)) {
    throw new Error(`${formatNativeWordPdfBackendLabel(backend.kind)} did not create the expected PDF output.`);
  }

  return backend.kind;
}

async function defaultCheckWordComAvailability() {
  if (process.platform !== 'win32') {
    return false;
  }

  const command = [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    "$ErrorActionPreference='Stop'; $word=$null; try { $word = New-Object -ComObject Word.Application; Write-Output 'available'; } finally { if ($word -ne $null) { $word.Quit(); [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($word); } }",
  ];

  try {
    const { stdout } = await execFileAsync('powershell.exe', command, { windowsHide: true });
    return stdout.toLowerCase().includes('available');
  } catch {
    return false;
  }
}

async function defaultFindLibreOfficeExecutable() {
  const lookupCommands = process.platform === 'win32'
    ? [
        ['where.exe', ['soffice.exe']],
        ['where.exe', ['libreoffice.exe']],
      ] as const
    : [
        ['which', ['soffice']],
        ['which', ['libreoffice']],
      ] as const;

  for (const [command, args] of lookupCommands) {
    try {
      const { stdout } = await execFileAsync(command, args, { windowsHide: true });
      const candidate = stdout
        .split(/\r?\n/)
        .map((value) => value.trim())
        .find(Boolean);

      if (candidate) {
        return candidate;
      }
    } catch {
      // Continue to known install paths.
    }
  }

  return resolveExistingExecutablePath(getPossibleLibreOfficeExecutables());
}

async function defaultRunWordComExport(inputPath: string, outputPath: string) {
  const scriptPath = path.join(process.cwd(), 'scripts', 'convert-word-to-pdf.ps1');

  await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-InputPath',
      inputPath,
      '-OutputPath',
      outputPath,
    ],
    { windowsHide: true },
  );
}

async function defaultRunLibreOfficeExport(executablePath: string, inputPath: string, outputPath: string) {
  const outputDirectory = path.dirname(outputPath);

  await execFileAsync(
    executablePath,
    ['--headless', '--convert-to', 'pdf:writer_pdf_Export', '--outdir', outputDirectory, inputPath],
    { windowsHide: true },
  );

  const generatedOutputPath = path.join(outputDirectory, `${path.parse(inputPath).name}.pdf`);
  if (path.resolve(generatedOutputPath) !== path.resolve(outputPath) && fs.existsSync(generatedOutputPath)) {
    fs.renameSync(generatedOutputPath, outputPath);
  }
}