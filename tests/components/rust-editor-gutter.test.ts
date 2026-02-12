import { describe, it, expect, vi } from 'vitest';
import { mount } from 'ripple';
import { EditorGutter } from '../../src/components/editor/EditorGutter.ripple';

function mountGutter(props: any) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  mount(EditorGutter, {
    target: container,
    props,
  });

  return {
    container,
    cleanup: () => container.remove(),
  };
}

function getLineNumbers(container: HTMLElement): number[] {
  const gutter = container.querySelector('[data-testid="editor-gutter"]');
  if (!gutter) return [];

  // Get all span elements that contain line numbers (direct text content)
  const lineElements = gutter.querySelectorAll('div > span:last-child');
  const numbers: number[] = [];

  for (const el of lineElements) {
    const num = parseInt(el.textContent || '', 10);
    if (!isNaN(num)) {
      numbers.push(num);
    }
  }

  return numbers;
}

describe('EditorGutter component', () => {
  it('renders line numbers for visible lines', () => {
    const { container, cleanup } = mountGutter({
      totalLines: 5,
      viewportStartLine: 0,
      viewportLineCount: 5,
      activeLine: 2,
      foldRanges: null,
      foldedStartLines: [],
      onToggleFold: () => {},
    });

    const gutter = container.querySelector('[data-testid="editor-gutter"]');
    expect(gutter).toBeTruthy();

    const text = gutter?.textContent || '';
    expect(text).toContain('1');
    expect(text).toContain('2');
    expect(text).toContain('3');

    cleanup();
  });

  it('invokes onToggleFold when fold toggle is clicked', () => {
    const onToggleFold = vi.fn();

    const { container, cleanup } = mountGutter({
      totalLines: 10,
      viewportStartLine: 0,
      viewportLineCount: 10,
      activeLine: 0,
      foldRanges: [
        {
          startLine: 1,
          endLine: 3,
          kind: 'Block',
        },
      ],
      foldedStartLines: [],
      onToggleFold,
    });

    const toggle = container.querySelector('.fold-toggle') as HTMLButtonElement | null;
    expect(toggle).toBeTruthy();

    toggle?.click();
    expect(onToggleFold).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('renders correct number of lines based on totalLines prop', () => {
    // Test with small file (5 lines)
    const { container: container1, cleanup: cleanup1 } = mountGutter({
      totalLines: 5,
      viewportStartLine: 0,
      viewportLineCount: 10,
      activeLine: 0,
      foldRanges: null,
      foldedStartLines: [],
      onToggleFold: () => {},
    });

    const lines1 = getLineNumbers(container1);
    expect(lines1).toContain(1);
    expect(lines1).toContain(5);
    expect(lines1.length).toBeLessThanOrEqual(6); // 5 lines + 1 for overfetch

    cleanup1();

    // Test with larger file (100 lines)
    const { container: container2, cleanup: cleanup2 } = mountGutter({
      totalLines: 100,
      viewportStartLine: 0,
      viewportLineCount: 20,
      activeLine: 0,
      foldRanges: null,
      foldedStartLines: [],
      onToggleFold: () => {},
    });

    const lines2 = getLineNumbers(container2);
    expect(lines2[0]).toBe(1);
    // Should only render visible lines + buffer, not all 100
    expect(lines2.length).toBeLessThanOrEqual(22);

    cleanup2();
  });

  it('renders lines starting from viewportStartLine when scrolled', () => {
    const { container, cleanup } = mountGutter({
      totalLines: 100,
      viewportStartLine: 50, // scrolled to line 50
      viewportLineCount: 20,
      activeLine: 55,
      foldRanges: null,
      foldedStartLines: [],
      onToggleFold: () => {},
    });

    const lines = getLineNumbers(container);

    // Should start from line 51 (0-indexed 50 + 1 for display)
    expect(lines[0]).toBe(51);
    // Should include the active line 56 (0-indexed 55 + 1)
    expect(lines).toContain(56);
    // Should not include early lines
    expect(lines).not.toContain(1);
    expect(lines).not.toContain(49);

    cleanup();
  });

  it('highlights the active line', () => {
    const { container, cleanup } = mountGutter({
      totalLines: 10,
      viewportStartLine: 0,
      viewportLineCount: 10,
      activeLine: 5,
      foldRanges: null,
      foldedStartLines: [],
      onToggleFold: () => {},
    });

    const gutter = container.querySelector('[data-testid="editor-gutter"]');
    const lineElements = gutter?.querySelectorAll('div > div') || [];

    // Find the line element for line 6 (0-indexed 5)
    let activeLine: Element | null = null;
    for (const el of lineElements) {
      if (el.textContent?.includes('6')) {
        activeLine = el;
        break;
      }
    }

    expect(activeLine).toBeTruthy();
    expect(activeLine?.classList.contains('bg-white/10')).toBe(true);

    cleanup();
  });

  it('uses fallback range when viewportLineCount is 0 (layout race condition)', () => {
    // This tests the guard at EditorGutter.ripple lines 28-34
    // When viewportLineCount is 0, rawLineCount = totalLines (line 30)
    // So it renders all lines when viewportLineCount is 0
    const { container, cleanup } = mountGutter({
      totalLines: 100,
      viewportStartLine: 0,
      viewportLineCount: 0, // simulates layout race where height not yet measured
      activeLine: 0,
      foldRanges: null,
      foldedStartLines: [],
      onToggleFold: () => {},
    });

    const lines = getLineNumbers(container);

    // When viewportLineCount is 0, rawLineCount = totalLines per line 30
    // So it renders all 100 lines (not a fallback of 50)
    expect(lines.length).toBe(100);
    expect(lines[0]).toBe(1);
    expect(lines[99]).toBe(100);

    cleanup();
  });

  it('shows fold indicators for fold ranges', () => {
    const { container, cleanup } = mountGutter({
      totalLines: 20,
      viewportStartLine: 0,
      viewportLineCount: 20,
      activeLine: 0,
      foldRanges: [
        { startLine: 2, endLine: 5, kind: 'Block' },
        { startLine: 10, endLine: 15, kind: 'Block' },
      ],
      foldedStartLines: [],
      onToggleFold: () => {},
    });

    const foldToggles = container.querySelectorAll('.fold-toggle');

    // Should have fold indicators for both fold ranges
    expect(foldToggles.length).toBe(2);

    cleanup();
  });

  it('shows collapsed indicator for folded lines', () => {
    const { container, cleanup } = mountGutter({
      totalLines: 20,
      viewportStartLine: 0,
      viewportLineCount: 20,
      activeLine: 0,
      foldRanges: [{ startLine: 2, endLine: 5, kind: 'Block' }],
      foldedStartLines: [2], // line 2 is folded
      onToggleFold: () => {},
    });

    const foldToggle = container.querySelector('.fold-toggle');

    // Should show collapsed indicator
    expect(foldToggle?.textContent).toContain('▸');

    cleanup();
  });

  it('shows expanded indicator for unfolded lines', () => {
    const { container, cleanup } = mountGutter({
      totalLines: 20,
      viewportStartLine: 0,
      viewportLineCount: 20,
      activeLine: 0,
      foldRanges: [{ startLine: 2, endLine: 5, kind: 'Block' }],
      foldedStartLines: [], // not folded
      onToggleFold: () => {},
    });

    const foldToggle = container.querySelector('.fold-toggle');

    // Should show expanded indicator
    expect(foldToggle?.textContent).toContain('▾');

    cleanup();
  });
});

describe('RustEditor style binding', () => {
  it('style binding includes px suffix for height (CSS unit validation)', async () => {
    // This tests the fix for the bug where style={{ height: @containerHeight || 400 + 'px' }}
    // was parsed as (height: containerHeight) || (400 + 'px') due to operator precedence,
    // resulting in invalid CSS like "height: 500" instead of "height: 500px"

    const container = document.createElement('div');
    container.style.height = '500px';
    document.body.appendChild(container);

    try {
      const { RustEditor } = await import('../../src/components/editor/RustEditor.ripple');
      const { mount, tick } = await import('ripple');

      // Mount with a test file
      mount(RustEditor, {
        target: container,
        props: {
          file: {
            id: 'style-test',
            path: '/style-test.ts',
            name: 'style-test.ts',
            content: 'const x = 1;',
            isDirty: false,
            language: 'typescript',
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Trigger resize observer to set container height
      const triggerResize = (globalThis as any).__triggerResizeObserver__ as (
        height: number
      ) => void;
      if (typeof triggerResize === 'function') {
        triggerResize(500);
        await tick();
      }

      // Find the element with the dynamic height style
      // This is the flex container that holds gutter + editor viewport
      const flexContainer = container.querySelector('.absolute.left-0.top-0.right-0.flex');

      expect(flexContainer).toBeTruthy();

      const style = (flexContainer as HTMLElement)?.style.height;
      // Should be a valid CSS value with px suffix
      expect(style).toMatch(/^\d+px$/);
      // Should NOT be just a number without units
      expect(style).not.toMatch(/^\d+$/);
    } finally {
      container.remove();
    }
  });
});
