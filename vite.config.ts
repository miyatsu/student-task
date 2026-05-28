import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const chunkedPackages = new Set([
  '@google/genai',
  '@tensorflow/tfjs',
  '@tensorflow/tfjs-backend-cpu',
  '@tensorflow/tfjs-backend-webgl',
  '@tensorflow/tfjs-converter',
  '@tensorflow/tfjs-core',
  '@tensorflow/tfjs-data',
  '@tensorflow/tfjs-layers',
  'browser-image-compression',
  'html2canvas',
  'html2pdf.js',
  'jspdf',
  'jszip',
  'mammoth',
  'pdf-lib',
  'pdfjs-dist',
  'upscaler',
]);

function getNodeModulePackageName(id: string) {
  const [, modulePath] = id.split('node_modules/');
  if (!modulePath) {
    return null;
  }

  const packagePath = modulePath.split(/[\\/]/);
  if (packagePath[0]?.startsWith('@')) {
    return packagePath.length > 1 ? `${packagePath[0]}/${packagePath[1]}` : null;
  }

  return packagePath[0] ?? null;
}

function buildVendorChunkName(packageName: string) {
  return `vendor-${packageName.replace(/[@/]/g, '-')}`;
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // The remaining heavy bundles are intentionally lazy-loaded toolchains
      // for local AI upscaling and Word/PDF rendering rather than startup code.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            const packageName = getNodeModulePackageName(id);
            if (!packageName || !chunkedPackages.has(packageName)) {
              return undefined;
            }

            return buildVendorChunkName(packageName);
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
