import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const localOcrRoot = path.join(projectRoot, '.local', 'paddleocr');
const localOcrVenv = path.join(localOcrRoot, 'venv');
const localOcrCache = path.join(localOcrRoot, 'cache');
const localOcrStateFile = path.join(localOcrRoot, 'install-state.json');
const warmupScript = path.join(projectRoot, 'scripts', 'local-ocr', 'warmup.py');

const requiredPythonMajor = 3;
const requiredPythonMinor = 9;
const paddlePaddleVersion = '3.2.0';

function log(message) {
  process.stdout.write(`${message}\n`);
}

function writeState(partialState) {
  fs.mkdirSync(localOcrRoot, { recursive: true });
  fs.writeFileSync(localOcrStateFile, JSON.stringify({
    engine: 'PaddleOCR',
    ready: false,
    offlineReady: false,
    updatedAt: new Date().toISOString(),
    ...partialState,
  }, null, 2));
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf-8',
    stdio: 'pipe',
    ...options,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const output = stderr || stdout || `Command failed: ${command} ${args.join(' ')}`;
    throw new Error(output);
  }

  return result.stdout.trim();
}

function getPythonCandidates() {
  if (process.platform === 'win32') {
    return [
      { command: 'py', baseArgs: ['-3.12'] },
      { command: 'py', baseArgs: ['-3.11'] },
      { command: 'py', baseArgs: ['-3.10'] },
      { command: 'py', baseArgs: ['-3.9'] },
      { command: 'python', baseArgs: [] },
      { command: 'python3', baseArgs: [] },
    ];
  }

  return [
    { command: 'python3', baseArgs: [] },
    { command: 'python', baseArgs: [] },
  ];
}

function parseVersion(versionText) {
  const match = versionText.match(/(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
  };
}

function isSupportedPythonVersion(version) {
  if (!version) {
    return false;
  }

  if (version.major !== requiredPythonMajor) {
    return false;
  }

  return version.minor >= requiredPythonMinor;
}

function findPythonCommand() {
  for (const candidate of getPythonCandidates()) {
    try {
      const versionText = runCommand(candidate.command, [...candidate.baseArgs, '--version']);
      const version = parseVersion(versionText);
      if (!isSupportedPythonVersion(version)) {
        continue;
      }

      return {
        ...candidate,
        versionText,
      };
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error('Python 3.9 or newer was not found. Install Python, then rerun npm install or npm run setup:ocr.');
}

function getVenvPythonExecutable() {
  return process.platform === 'win32'
    ? path.join(localOcrVenv, 'Scripts', 'python.exe')
    : path.join(localOcrVenv, 'bin', 'python');
}

function ensureVirtualEnvironment(pythonCommand) {
  const venvPython = getVenvPythonExecutable();
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  fs.mkdirSync(localOcrRoot, { recursive: true });
  log(`Creating local OCR virtual environment with ${pythonCommand.versionText}...`);
  runCommand(pythonCommand.command, [...pythonCommand.baseArgs, '-m', 'venv', localOcrVenv]);
  return venvPython;
}

function verifyPythonPackages(venvPython) {
  try {
    runCommand(venvPython, ['-c', 'import paddle; import paddleocr; print("ok")']);
    return true;
  } catch {
    return false;
  }
}

function installPythonPackages(venvPython) {
  const env = {
    ...process.env,
    PADDLE_HOME: localOcrCache,
    PCIE_PADDLEOCR_CACHE_DIR: localOcrCache,
    PYTHONUTF8: '1',
    PIP_DISABLE_PIP_VERSION_CHECK: '1',
  };

  log('Upgrading pip tooling for the local OCR environment...');
  runCommand(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel'], { env });

  log(`Installing paddlepaddle==${paddlePaddleVersion} (CPU)...`);
  runCommand(
    venvPython,
    ['-m', 'pip', 'install', `paddlepaddle==${paddlePaddleVersion}`, '-i', 'https://www.paddlepaddle.org.cn/packages/stable/cpu/'],
    { env },
  );

  log('Installing paddleocr...');
  runCommand(venvPython, ['-m', 'pip', 'install', 'paddleocr'], { env });
}

function warmupLocalOcr(venvPython) {
  log('Warming the local PaddleOCR models for offline use...');
  runCommand(venvPython, [warmupScript], {
    env: {
      ...process.env,
      PADDLE_HOME: localOcrCache,
      PCIE_PADDLEOCR_CACHE_DIR: localOcrCache,
      PYTHONUTF8: '1',
    },
  });
}

function bootstrapLocalOcr() {
  if (process.env.SKIP_LOCAL_OCR_SETUP === '1') {
    writeState({
      detail: 'Local PaddleOCR setup was skipped because SKIP_LOCAL_OCR_SETUP=1.',
    });
    log('Skipping local PaddleOCR setup because SKIP_LOCAL_OCR_SETUP=1.');
    return;
  }

  const pythonCommand = findPythonCommand();
  const venvPython = ensureVirtualEnvironment(pythonCommand);
  fs.mkdirSync(localOcrCache, { recursive: true });

  if (!verifyPythonPackages(venvPython)) {
    installPythonPackages(venvPython);
  } else {
    log('Local PaddleOCR Python packages are already installed.');
  }

  warmupLocalOcr(venvPython);

  writeState({
    ready: true,
    offlineReady: true,
    detail: 'Local PaddleOCR bootstrap completed successfully.',
    pythonExecutable: path.relative(projectRoot, venvPython),
  });
  log('Local PaddleOCR is ready for offline image OCR.');
}

try {
  bootstrapLocalOcr();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeState({
    detail: message,
  });
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}