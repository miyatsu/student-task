import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { once } from 'events';

import type { AiOcrRequestBody, AiRequestFile, LocalImageOcrRuntimeSummary } from '../lib/ai-types';

const LOCAL_OCR_REQUEST_TIMEOUT_MS = 300_000;
const LOCAL_OCR_STARTUP_TIMEOUT_MS = 300_000;

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
  id: string;
  file: AiRequestFile;
}

interface LocalImageOcrRunnerMessage {
  type?: 'ready' | 'result' | 'error';
  id?: string;
  text?: string;
  error?: string;
}

interface PendingLocalOcrRequest {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface LocalOcrWorkerHandle {
  child: ChildProcessWithoutNullStreams;
  stdoutReader: readline.Interface;
  rootDir: string;
  stderr: string;
  ready: boolean;
  startupSettled: boolean;
  disposed: boolean;
  startupTimer: ReturnType<typeof setTimeout>;
  pendingRequests: Map<string, PendingLocalOcrRequest>;
  readyPromise: Promise<LocalOcrWorkerHandle>;
}

let localOcrWorker: LocalOcrWorkerHandle | null = null;
let localOcrRequestSequence = 0;
let localOcrCleanupRegistered = false;

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

function buildLocalOcrNotReadyError(detail: string) {
  return new LocalOcrRequestError(detail, 503, 'local-ocr-not-ready');
}

function registerLocalOcrProcessCleanup() {
  if (localOcrCleanupRegistered) {
    return;
  }

  process.once('exit', () => {
    try {
      localOcrWorker?.child.kill();
    } catch {
      // Best-effort cleanup only.
    }
  });

  localOcrCleanupRegistered = true;
}

function appendWorkerStderr(worker: LocalOcrWorkerHandle, chunk: Buffer | string) {
  worker.stderr = `${worker.stderr}${chunk.toString()}`.slice(-8_000);
}

function buildWorkerFailureMessage(worker: LocalOcrWorkerHandle, fallbackMessage: string) {
  return worker.stderr.trim() || fallbackMessage;
}

function rejectPendingWorkerRequests(worker: LocalOcrWorkerHandle, error: Error) {
  for (const [requestId, pendingRequest] of worker.pendingRequests) {
    clearTimeout(pendingRequest.timeout);
    pendingRequest.reject(error);
    worker.pendingRequests.delete(requestId);
  }
}

function disposeLocalOcrWorker(worker: LocalOcrWorkerHandle, error?: Error, shouldKillChild = true) {
  if (worker.disposed) {
    return;
  }

  worker.disposed = true;

  if (localOcrWorker === worker) {
    localOcrWorker = null;
  }

  clearTimeout(worker.startupTimer);

  try {
    worker.stdoutReader.close();
  } catch {
    // Best-effort cleanup only.
  }

  if (error) {
    rejectPendingWorkerRequests(worker, error);
  }

  if (shouldKillChild && !worker.child.killed) {
    try {
      worker.child.kill();
    } catch {
      // Best-effort cleanup only.
    }
  }
}

function handleLocalOcrWorkerMessage(
  worker: LocalOcrWorkerHandle,
  line: string,
  settleStartup: (error?: LocalOcrRequestError) => void,
) {
  if (!line.trim()) {
    return;
  }

  let message: LocalImageOcrRunnerMessage;
  try {
    message = JSON.parse(line) as LocalImageOcrRunnerMessage;
  } catch (error) {
    const parseError = new LocalOcrRequestError(
      `Local PaddleOCR returned malformed output: ${error instanceof Error ? error.message : String(error)}`,
      502,
      'local-ocr-invalid-output',
    );

    if (!worker.startupSettled) {
      settleStartup(parseError);
      return;
    }

    disposeLocalOcrWorker(worker, parseError);
    return;
  }

  if (message.type === 'ready') {
    settleStartup();
    return;
  }

  if (!message.id) {
    return;
  }

  const pendingRequest = worker.pendingRequests.get(message.id);
  if (!pendingRequest) {
    return;
  }

  worker.pendingRequests.delete(message.id);
  clearTimeout(pendingRequest.timeout);

  if (message.type === 'error') {
    pendingRequest.reject(new LocalOcrRequestError(message.error || 'Local PaddleOCR exited unexpectedly.', 502, 'local-ocr-run-failed'));
    return;
  }

  pendingRequest.resolve(typeof message.text === 'string' ? message.text : '');
}

async function ensureLocalOcrWorker(rootDir = process.cwd()) {
  const state = readLocalOcrInstallState(rootDir);
  const pythonExecutable = resolveLocalOcrPythonExecutable(rootDir, state ?? undefined);
  const runnerPath = path.resolve(rootDir, 'scripts', 'local-ocr', 'ocr_runner.py');

  if (!fs.existsSync(pythonExecutable) || !fs.existsSync(runnerPath)) {
    throw buildLocalOcrNotReadyError(buildLocalOcrNotReadyDetail(state));
  }

  if (localOcrWorker && localOcrWorker.rootDir === rootDir) {
    return localOcrWorker.readyPromise;
  }

  if (localOcrWorker) {
    disposeLocalOcrWorker(localOcrWorker, undefined, true);
  }

  registerLocalOcrProcessCleanup();

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

  const stdoutReader = readline.createInterface({ input: child.stdout });

  const worker: LocalOcrWorkerHandle = {
    child,
    stdoutReader,
    rootDir,
    stderr: '',
    ready: false,
    startupSettled: false,
    disposed: false,
    startupTimer: undefined as unknown as ReturnType<typeof setTimeout>,
    pendingRequests: new Map<string, PendingLocalOcrRequest>(),
    readyPromise: Promise.resolve(undefined as unknown as LocalOcrWorkerHandle),
  };

  worker.readyPromise = new Promise<LocalOcrWorkerHandle>((resolve, reject) => {
    const settleStartup = (error?: LocalOcrRequestError) => {
      if (worker.startupSettled) {
        return;
      }

      worker.startupSettled = true;
      clearTimeout(worker.startupTimer);

      if (error) {
        disposeLocalOcrWorker(worker, error);
        reject(error);
        return;
      }

      worker.ready = true;
      resolve(worker);
    };

    worker.startupTimer = setTimeout(() => {
      settleStartup(new LocalOcrRequestError(
        'Local PaddleOCR worker startup timed out. Retry the request or rerun npm run setup:ocr if the runtime is unhealthy.',
        504,
        'local-ocr-startup-timeout',
      ));
    }, LOCAL_OCR_STARTUP_TIMEOUT_MS);

    stdoutReader.on('line', (line) => {
      handleLocalOcrWorkerMessage(worker, line, settleStartup);
    });

    child.stderr.on('data', (chunk) => {
      appendWorkerStderr(worker, chunk);
    });

    child.on('error', (error) => {
      settleStartup(new LocalOcrRequestError(`Failed to start the local PaddleOCR runner: ${error.message}`, 500, 'local-ocr-launch-failed'));
    });

    child.on('close', (code) => {
      const fallbackMessage = code === null
        ? 'Local PaddleOCR exited unexpectedly.'
        : `Local PaddleOCR exited unexpectedly with code ${code}.`;
      const workerError = new LocalOcrRequestError(
        buildWorkerFailureMessage(worker, fallbackMessage),
        worker.ready ? 502 : 500,
        worker.ready ? 'local-ocr-run-failed' : 'local-ocr-launch-failed',
      );

      if (!worker.startupSettled) {
        settleStartup(workerError);
        return;
      }

      disposeLocalOcrWorker(worker, workerError, false);
    });
  });

  localOcrWorker = worker;
  return worker.readyPromise;
}

function prewarmLocalOcrWorker(rootDir = process.cwd()) {
  void ensureLocalOcrWorker(rootDir).catch(() => {
    // Keep runtime summary reads fast and side-effect tolerant.
    // OCR requests surface actionable errors when the worker cannot start.
  });
}

function shouldPrewarmLocalOcrWorker() {
  return process.env.VITEST !== 'true'
    && process.env.VITEST !== '1'
    && process.env.NODE_ENV !== 'test'
    && process.env.PCIE_DISABLE_LOCAL_OCR_PREWARM !== '1';
}

export function readLocalImageOcrRuntime(rootDir = process.cwd()): LocalImageOcrRuntimeSummary {
  const state = readLocalOcrInstallState(rootDir);
  const pythonExecutable = resolveLocalOcrPythonExecutable(rootDir, state ?? undefined);
  const pythonExists = fs.existsSync(pythonExecutable);
  const runnerExists = fs.existsSync(path.resolve(rootDir, 'scripts', 'local-ocr', 'ocr_runner.py'));
  const available = Boolean(state?.ready && state?.offlineReady && pythonExists && runnerExists);

  if (available && shouldPrewarmLocalOcrWorker()) {
    prewarmLocalOcrWorker(rootDir);
  }

  return {
    engine: state?.engine || 'PaddleOCR',
    available,
    offlineReady: Boolean(state?.offlineReady && pythonExists),
    detail: available
      ? 'Local PaddleOCR is installed and ready for offline image OCR.'
      : buildLocalOcrNotReadyDetail(state),
  };
}

async function executePaddleOcr(request: AiOcrRequestBody, rootDir = process.cwd()) {
  const state = readLocalOcrInstallState(rootDir);
  const pythonExecutable = resolveLocalOcrPythonExecutable(rootDir, state ?? undefined);
  const runnerPath = path.resolve(rootDir, 'scripts', 'local-ocr', 'ocr_runner.py');

  if (!fs.existsSync(pythonExecutable) || !fs.existsSync(runnerPath)) {
    throw buildLocalOcrNotReadyError(buildLocalOcrNotReadyDetail(state));
  }

  const worker = await ensureLocalOcrWorker(rootDir);
  const requestId = `ocr-${Date.now()}-${++localOcrRequestSequence}`;

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.pendingRequests.delete(requestId);

      const timeoutError = new LocalOcrRequestError(
        'Local image OCR timed out. Retry the request or rerun npm run setup:ocr if the PaddleOCR runtime is unhealthy.',
        504,
        'local-ocr-timeout',
      );

      disposeLocalOcrWorker(worker, timeoutError);
      reject(timeoutError);
    }, LOCAL_OCR_REQUEST_TIMEOUT_MS);

    worker.pendingRequests.set(requestId, {
      resolve,
      reject,
      timeout,
    });

    const payload: LocalImageOcrRunnerPayload = {
      id: requestId,
      file: request.file,
    };

    worker.child.stdin.write(`${JSON.stringify(payload)}\n`, (error) => {
      if (!error) {
        return;
      }

      const pendingRequest = worker.pendingRequests.get(requestId);
      if (!pendingRequest) {
        return;
      }

      clearTimeout(pendingRequest.timeout);
      worker.pendingRequests.delete(requestId);

      const launchError = new LocalOcrRequestError(`Failed to send the image to the local PaddleOCR runner: ${error.message}`, 500, 'local-ocr-launch-failed');
      disposeLocalOcrWorker(worker, launchError);
      reject(launchError);
    });
  });
}

export function isLocalOcrRequestError(error: unknown): error is LocalOcrRequestError {
  return error instanceof LocalOcrRequestError;
}

export async function shutdownLocalOcrWorker() {
  const worker = localOcrWorker;
  if (!worker || worker.disposed) {
    return;
  }

  const closePromise = once(worker.child, 'close').then(() => undefined).catch(() => undefined);
  disposeLocalOcrWorker(worker, undefined, true);
  await closePromise;
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