export interface WordPdfRenderHost {
  host: HTMLDivElement;
  source: HTMLDivElement;
  dispose: () => void;
}

export function createWordPdfRenderHost(html: string): WordPdfRenderHost {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';
  host.style.overflow = 'hidden';

  const source = document.createElement('div');
  source.innerHTML = html;
  source.style.width = '210mm';
  source.style.padding = '20mm';
  source.style.boxSizing = 'border-box';
  source.style.backgroundColor = 'white';
  source.style.color = 'black';
  source.style.fontFamily = 'Arial, sans-serif';
  source.style.lineHeight = '1.5';

  host.appendChild(source);
  document.body.appendChild(host);

  return {
    host,
    source,
    dispose: () => {
      host.remove();
    },
  };
}