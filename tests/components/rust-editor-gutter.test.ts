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
})

