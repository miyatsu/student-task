import { afterEach, describe, expect, it } from 'vitest';

import { createWordPdfRenderHost } from './word-pdf';

describe('createWordPdfRenderHost', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the render source in normal flow inside an invisible host', () => {
    const renderHost = createWordPdfRenderHost('<p>Hello</p><p>World</p>');

    expect(document.body.contains(renderHost.host)).toBe(true);
    expect(renderHost.host.getAttribute('aria-hidden')).toBe('true');
    expect(renderHost.host.style.position).toBe('fixed');
    expect(renderHost.host.style.opacity).toBe('0');
    expect(renderHost.host.style.pointerEvents).toBe('none');
    expect(renderHost.source.parentElement).toBe(renderHost.host);
    expect(renderHost.source.style.position).toBe('');
    expect(renderHost.source.style.width).toBe('210mm');
    expect(renderHost.source.style.boxSizing).toBe('border-box');
    expect(renderHost.source.textContent).toContain('Hello');
    expect(renderHost.source.textContent).toContain('World');

    renderHost.dispose();

    expect(document.body.contains(renderHost.host)).toBe(false);
  });
});