import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { runLocalImageOcrRequest, shutdownLocalOcrWorker } from '../../src/server/local-ocr.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const defaultImagePath = path.join(projectRoot, '.local', 'paddleocr', 'smoke-test.png');
const expectedTokens = ['ocr', 'smoke'];

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

async function main() {
  const imagePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultImagePath;

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Smoke image was not found at ${imagePath}. Run the image generator first.`);
  }

  const data = fs.readFileSync(imagePath, 'base64');
  const startedAt = Date.now();
  const result = await runLocalImageOcrRequest({
    file: {
      data,
      mimeType: 'image/png',
      name: path.basename(imagePath),
    },
  });

  const textPreview = result.text.slice(0, 200);
  const normalizedText = normalizeForMatch(result.text);
  const missingTokens = expectedTokens.filter((token) => !normalizedText.includes(token));
  const payload = {
    imagePath: path.relative(projectRoot, imagePath).replace(/\\/g, '/'),
    ms: Date.now() - startedAt,
    textPreview,
    missingTokens,
  };

  if (missingTokens.length > 0) {
    throw new Error(JSON.stringify(payload));
  }

  console.log(JSON.stringify(payload));
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
} finally {
  await shutdownLocalOcrWorker();
}