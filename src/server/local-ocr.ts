import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

import type { AiOcrRequestBody, AiRequestFile, LocalImageOcrRuntimeSummary } from '../lib/ai-types';

const LOCAL_OCR_ROOT_DIR = path.resolve(process.cwd(), '.local', 'paddleocr');
const LOCAL_OCR_STATE_FILE = path.join(LOCAL_OCR_ROOT_DIR, 'install-state.json');
const LOCAL_OCR_VENV_DIR = path.join(LOCAL_OCR_ROOT_DIR, 'venv');
const LOCAL_OCR_CACHE_DIR = path.join(LOCAL_OCR_ROOT_DIR, 'cache');
const LOCAL_OCR_RUNNER = path.resolve(process.cwd(), 'scripts', 'local-ocr', 'ocr_runner.py');
const LOCAL_OCR_TIMEOUT_MS = 120_000;

interface LocalOcrInstallState {
  engine?: string;
  ready?: boolean;
  offlineReady?: boolean;
  detail?: string;
  pythonExecutable?: string;
  updatedAt?: string;
}

interface LocalImageOcrDependencies {
  readRuntimeSummary?: () => LocalImageOcrRuntimeSummary;
  executeOcr?: (request: AiOcrRequestBody) => Promise<string>;
}

interface LocalImageOcrRunnerPayload {
  file: AiRequestFile;
}

export class LocalOcrRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = 'local-ocr-invalid') {
    super(message);
    this.name = 'LocalOcrRequestError';
    this.status = status;
    this.code = code;
  }
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function ensureRecord(value: unknown, message: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LocalOcrRequestError(message);
  }

  return value as Record<string, unknown>;
}

function normalizeAiFile(value: unknown, fieldLabel: string): AiRequestFile {
  const record = ensureRecord(value, `${fieldLabel} is malformed.`);
  const data = normalizeString(record.data);
  const mimeType = normalizeString(record.mimeType);
  const name = normalizeString(record.name) || 'image';

  if (!data) {
    throw new LocalOcrRequestError(`${fieldLabel} is missing base64 data.`);
  }

  if (!mimeType) {
    throw new LocalOcrRequestError(`${fieldLabel} is missing a MIME type.`);
  }

  return { data, mimeType, name };
}

function normalizeLocalImageOcrRequest(body: unknown): AiOcrRequestBody {
  const record = ensureRecord(body, 'Image OCR request body is malformed.');
  const file = normalizeAiFile(record.file, 'file');

  if (!file.mimeType.startsWith('image/')) {
    throw new LocalOcrRequestError('Local image OCR only accepts image files.');
  }

  return { file };
}

function resolveLocalOcrStateFile(rootDir = process.cwd()) {
  return path.join(rootDir, '.local', 'paddleocr', 'install-state.json');
}

function resolveLocalOcrPythonExecutable(rootDir = process.cwd(), state?: LocalOcrInstallState) {
  if (state?.pythonExecutable) {
    return path.isAbsolute(state.pythonExecutable)
      ? state.pythonExecutable
      : path.resolve(rootDir, state.pythonExecutable);
  }

  return process.platform === 'win32'
    ? path.join(rootDir, '.local', 'paddleocr', 'venv', 'Scripts', 'python.exe')
    : path.join(rootDir, '.local', 'paddleocr', 'venv', 'bin', 'python');
}

function readLocalOcrInstallState(rootDir = process.cwd()): LocalOcrInstallState | null {
  const stateFilePath = resolveLocalOcrStateFile(rootDir);
  if (!fs.existsSync(stateFilePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(stateFilePath, 'utf-8');
    return JSON.parse(raw) as LocalOcrInstallState;
  } catch {
    return null;
  }
}

function buildLocalOcrNotReadyDetail(state: LocalOcrInstallState | null) {
  if (state?.detail) {
    return state.detail;
  }

  return 'Local PaddleOCR is not ready. Install Python 3.9 or newer, then run npm install or npm run setup:ocr to bootstrap the offline OCR runtime.';
}

export function readLocalImageOcrRuntime(rootDir = process.cwd()): LocalImageOcrRuntimeSummary {
  const state = readLocalOcrInstallState(rootDir);
  const pythonExecutable = resolveLocalOcrPythonExecutable(rootDir, state ?? undefined);
  const pythonExists = fs.existsSync(pythonExecutable);
  const runnerExists = fs.existsSync(path.resolve(rootDir, 'scripts', 'local-ocr', 'ocr_runner.py'));
  const available = Boolean(state?.ready && state?.offlineReady && pythonExists && runnerExists);

  return {
    engine: state?.engine || 'PaddleOCR',
    available,
    offlineReady: Boolean(state?.offlineReady && pythonExists),
    detail: available
      ? 'Local PaddleOCR is installed and ready for offline image OCR.'
      : buildLocalOcrNotReadyDetail(state),
  };
}

function buildLocalOcrNotReadyError(detail: string) {
  return new LocalOcrRequestError(detail, 503, 'local-ocr-not-ready');
}

async function executePaddleOcr(request: AiOcrRequestBody, rootDir = process.cwd()) {
  const state = readLocalOcrInstallState(rootDir);
  const pythonExecutable = resolveLocalOcrPythonExecutable(rootDir, state ?? undefined);
  const runnerPath = path.resolve(rootDir, 'scripts', 'local-ocr', 'ocr_runner.py');

  if (!fs.existsSync(pythonExecutable) || !fs.existsSync(runnerPath)) {
    throw buildLocalOcrNotReadyError(buildLocalOcrNotReadyDetail(state));
  }

  const payload: LocalImageOcrRunnerPayload = { file: request.file };

  return new Promise<string>((resolve, reject) => {
    const child = spawn(pythonExecutable, [runnerPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        PADDLE_HOME: path.join(rootDir, '.local', 'paddleocr', 'cache'),
        PCIE_PADDLEOCR_CACHE_DIR: path.join(rootDir, '.local', 'paddleocr', 'cache'),
        PYTHONUTF8: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let completed = false;

    const finish = (error?: Error, text?: string) => {
      if (completed) {
        return;
      }

      completed = true;
      if (error) {
        reject(error);
        return;
      }

      resolve(text || '');
    };

    const timeout = setTimeout(() => {
      child.kill();
      finish(new LocalOcrRequestError('Local image OCR timed out. Retry the request or rerun npm run setup:ocr if the PaddleOCR runtime is unhealthy.', 504, 'local-ocr-timeout'));
    }, LOCAL_OCR_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      finish(new LocalOcrRequestError(`Failed to start the local PaddleOCR runner: ${error.message}`, 500, 'local-ocr-launch-failed'));
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        const message = stderr.trim() || stdout.trim() || 'Local PaddleOCR exited unexpectedly.';
        finish(new LocalOcrRequestError(message, 502, 'local-ocr-run-failed'));
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as { text?: string; error?: string };
        if (parsed.error) {
          finish(new LocalOcrRequestError(parsed.error, 502, 'local-ocr-run-failed'));
          return;
        }

        finish(undefined, typeof parsed.text === 'string' ? parsed.text : '');
      } catch (error) {
        finish(new LocalOcrRequestError(`Local PaddleOCR returned malformed output: ${error instanceof Error ? error.message : String(error)}`, 502, 'local-ocr-invalid-output'));
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

export function isLocalOcrRequestError(error: unknown): error is LocalOcrRequestError {
  return error instanceof LocalOcrRequestError;
}

export async function runLocalImageOcrRequest(body: unknown, dependencies: LocalImageOcrDependencies = {}) {
  const request = normalizeLocalImageOcrRequest(body);
  const readRuntimeSummary = dependencies.readRuntimeSummary ?? readLocalImageOcrRuntime;
  const executeOcr = dependencies.executeOcr ?? executePaddleOcr;
  const runtimeSummary = readRuntimeSummary();

  if (!runtimeSummary.available || !runtimeSummary.offlineReady) {
    throw buildLocalOcrNotReadyError(runtimeSummary.detail);
  }

  const text = await executeOcr(request);
  return { text };
}

export const __internal = {
  normalizeLocalImageOcrRequest,
  readLocalOcrInstallState,
  resolveLocalOcrPythonExecutable,
};