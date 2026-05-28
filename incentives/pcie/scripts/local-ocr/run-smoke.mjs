import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const localOcrRoot = path.join(projectRoot, '.local', 'paddleocr');
const bootstrapScript = path.join(projectRoot, 'scripts', 'bootstrap-local-ocr.mjs');
const makeSmokeImageScript = path.join(__dirname, 'make-smoke-image.py');
const smokeLocalOcrScript = path.join(__dirname, 'smoke-local-ocr.mts');
const smokeImagePath = path.join(localOcrRoot, 'smoke-test.png');

function getVenvPythonExecutable() {
  return process.platform === 'win32'
    ? path.join(localOcrRoot, 'venv', 'Scripts', 'python.exe')
    : path.join(localOcrRoot, 'venv', 'bin', 'python');
}

function runCommand(command, args, label) {
  process.stdout.write(`${label}\n`);

  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      PYTHONUTF8: '1',
    },
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  runCommand(process.execPath, [bootstrapScript], 'Ensuring local PaddleOCR runtime is ready...');

  const venvPython = getVenvPythonExecutable();
  if (!fs.existsSync(venvPython)) {
    throw new Error('Local OCR virtual environment is missing. Run "npm run setup:ocr" and try again.');
  }

  runCommand(venvPython, [makeSmokeImageScript], 'Generating local OCR smoke image...');
  runCommand(process.execPath, ['--import', 'tsx', smokeLocalOcrScript, smokeImagePath], 'Running local OCR smoke check...');
  process.stdout.write('Local OCR smoke check passed.\n');
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}