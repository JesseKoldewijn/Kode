import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushSync } from 'ripple';
import { SubscriberTest, notify } from './subscription-reactivity.ripple';
import { WorkspaceFileIdDisplay } from './workspace-subscriber.ripple';
import { MinimalEditorArea } from './minimal-editor-area.ripple';
import * as workspace from '../../src/lib/workspace';

describe('subscription reactivity', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container?.remove();
  });

  it('updates when subscription callback calls rippleSet', async () => {
    mount(SubscriberTest, { target: container, props: {} });

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe('0');

    flushSync(() => {
      notify(42);
    });

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe('42');
  });

  it('workspace subscribeToActiveFile + rippleSet updates when called inside flushSync', async () => {
    workspace.openFiles.length = 0;
    const fileA: workspace.OpenFile = {
      id: 'file-a',
      path: '/a.ts',
      name: 'a.ts',
      content: 'a',
      isDirty: false,
      language: 'ts',
    };
    const fileB: workspace.OpenFile = {
      id: 'file-b',
      path: '/b.ts',
      name: 'b.ts',
      content: 'b',
      isDirty: false,
      language: 'ts',
    };
    workspace.openFiles.push(fileA, fileB);
    workspace.setActiveFileId(fileA.id);

    // Use mountComponent pattern (same as EditorArea test) to isolate mount differences
    const testContainer = document.createElement('div');
    testContainer.id = 'test-root';
    document.body.appendChild(testContainer);
    mount(WorkspaceFileIdDisplay, {
      target: testContainer,
      props: { activeFile: workspace.getActiveFile() },
    });

    expect(testContainer.querySelector('[data-testid="workspace-file-id"]')?.textContent).toBe(
      'file-a'
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    flushSync(() => {
      workspace.setActiveFileId(fileB.id);
    });

    expect(testContainer.querySelector('[data-testid="workspace-file-id"]')?.textContent).toBe(
      'file-b'
    );

    testContainer.remove();
  });

  it('MinimalEditorArea (EditorArea structure without children) updates when call inside flushSync', async () => {
    workspace.openFiles.length = 0;
    const fileA: workspace.OpenFile = {
      id: 'file-a',
      path: '/a.ts',
      name: 'a.ts',
      content: 'a',
      isDirty: false,
      language: 'ts',
    };
    const fileB: workspace.OpenFile = {
      id: 'file-b',
      path: '/b.ts',
      name: 'b.ts',
      content: 'b',
      isDirty: false,
      language: 'ts',
    };
    workspace.openFiles.push(fileA, fileB);
    workspace.setActiveFileId(fileA.id);

    const testContainer = document.createElement('div');
    testContainer.id = 'test-root';
    document.body.appendChild(testContainer);
    mount(MinimalEditorArea, {
      target: testContainer,
      props: { activeFile: workspace.getActiveFile() },
    });

    expect(testContainer.querySelector('[data-current-file-id]')?.getAttribute('data-current-file-id')).toBe(
      'file-a'
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    flushSync(() => {
      workspace.setActiveFileId(fileB.id);
    });

    expect(testContainer.querySelector('[data-testid="editor-area"]')?.getAttribute('data-current-file-id')).toBe(
      'file-b'
    );

    testContainer.remove();
  });
});
