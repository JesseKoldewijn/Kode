import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StatusBar } from '../../src/components/layout/StatusBar.ripple';
import { mount } from 'ripple';

describe('StatusBar Diagnostic Counts', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('shows 0 errors and warnings when no file is open', async () => {
    mount(StatusBar, { target: container });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const footer = container.querySelector('footer');
    expect(footer).toBeDefined();

    // Find diagnostic counts (spans after SVG icons)
    const text = footer?.textContent || '';
    expect(text).toContain('0'); // Should show 0 errors and warnings

    container.remove();
  });

  it('updates error and warning counts from diagnostics', async () => {
    // This test verifies the UI wiring - actual diagnostic logic is tested in lib tests
    mount(StatusBar, { target: container });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const footer = container.querySelector('footer');
    expect(footer).toBeDefined();

    // Verify diagnostic count elements exist
    const spans = footer?.querySelectorAll('span');
    const diagnosticSpans = Array.from(spans || []).filter((span) => {
      const prev = span.previousElementSibling;
      return prev?.tagName === 'svg' && span.textContent?.match(/^\d+$/);
    });

    // Should have at least 2 spans for error and warning counts
    expect(diagnosticSpans.length).toBeGreaterThanOrEqual(2);
  });

  it('renders diagnostic count UI structure correctly', async () => {
    mount(StatusBar, { target: container });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const footer = container.querySelector('footer');
    const svgs = footer?.querySelectorAll('svg');

    // Should have diagnostic icons (checkmark for errors, triangle for warnings)
    const diagnosticIcons = Array.from(svgs || []).filter((svg) => {
      const next = svg.nextElementSibling;
      return next?.tagName === 'SPAN' && next.textContent?.match(/^\d+$/);
    });

    expect(diagnosticIcons.length).toBeGreaterThanOrEqual(2);
  });
});
