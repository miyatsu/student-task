export type CompressionLevel = 'low' | 'medium' | 'high';

const compressionSettingsByLevel: Record<CompressionLevel, string> = {
  low: '/screen',
  medium: '/ebook',
  high: '/printer',
};

export function resolvePdfCompressionSettings(level?: string) {
  if (level === 'low' || level === 'high') {
    return compressionSettingsByLevel[level];
  }

  return compressionSettingsByLevel.medium;
}

export function createCompressionJobId(
  now: () => number = Date.now,
  random: () => number = Math.random,
) {
  return `${now()}-${random().toString(36).substring(7)}`;
}

interface GhostscriptCompressionCommandOptions {
  inputPath: string;
  outputPath: string;
  pdfSettings: string;
}

export function buildGhostscriptCompressionCommand({
  inputPath,
  outputPath,
  pdfSettings,
}: GhostscriptCompressionCommandOptions) {
  return `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${pdfSettings} -dColorImageDownsampleType=/Subsample -dGrayImageDownsampleType=/Subsample -dMonoImageDownsampleType=/Subsample -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;
}