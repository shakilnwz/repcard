import { useCallback, useEffect, useRef, useState } from 'react';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  redo,
  undo,
} from '@codemirror/commands';
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { vim } from '@replit/codemirror-vim';
import { Save, Undo2, Redo2, CheckSquare, Link2, Heading2, Code, Bold } from '@/shared/ui/MaterialIcons';

export interface MarkdownEditorProps {
  filePath: string;
  initialContent: string;
  vimMode: boolean;
  onToggleVim: (enabled: boolean) => void;
  onSave: (content: string) => Promise<void> | void;
  onChange?: (content: string) => void;
  saving?: boolean;
  readOnly?: boolean;
}

const darkLayoutOverride = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--bg-canvas)',
      color: '#ffffff',
      fontSize: '14px',
      height: '100%',
    },
    '.cm-content': {
      caretColor: '#a7ff83',
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      padding: '12px 0',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#a7ff83',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg-surface)',
      color: 'rgba(255, 255, 255, 0.55)',
      borderRight: 'none',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(167, 255, 131, 0.08)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--bg-elevated)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(167, 255, 131, 0.22)',
    },
    '.cm-scroller': {
      overflow: 'auto',
    },
  },
  { dark: true },
);

export function MarkdownEditor({
  filePath,
  initialContent,
  vimMode,
  onToggleVim,
  onSave,
  onChange,
  saving = false,
  readOnly = false,
}: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompRef = useRef(new Compartment());
  const vimCompRef = useRef(new Compartment());
  const editableCompRef = useRef(new Compartment());

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const savedContentRef = useRef(initialContent);
  const lastEmittedRef = useRef(initialContent);
  const [dirty, setDirty] = useState(false);

  const triggerSave = useCallback(async () => {
    const view = viewRef.current;
    if (!view || readOnly) return;
    const text = view.state.doc.toString();
    await onSaveRef.current(text);
    savedContentRef.current = text;
    lastEmittedRef.current = text;
    setDirty(false);
  }, [readOnly]);

  // Create editor instance per active filePath so undo history stays scoped per note.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    savedContentRef.current = initialContent;
    lastEmittedRef.current = initialContent;
    setDirty(false);

    const themeExt: Extension = [oneDark, darkLayoutOverride];

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        vimCompRef.current.of(vimMode ? vim() : []),
        themeCompRef.current.of(themeExt),
        editableCompRef.current.of(EditorView.editable.of(!readOnly)),
        lineNumbers(),
        highlightActiveLine(),
        history(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        EditorView.lineWrapping,
        keymap.of([
          {
            key: 'Mod-s',
            run: () => {
              void triggerSave();
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          const next = update.state.doc.toString();
          lastEmittedRef.current = next;
          setDirty(next !== savedContentRef.current);
          onChangeRef.current?.(next);
        }),
      ],
    });

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;

    return () => {
      viewRef.current = null;
      view.destroy();
    };
    // Re-create only when switching files; dynamic props reconfigure via Compartments below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  // Reconfigure Vim extension dynamically.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: vimCompRef.current.reconfigure(vimMode ? vim() : []),
    });
  }, [vimMode]);

  // Reconfigure readOnly dynamically.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editableCompRef.current.reconfigure(EditorView.editable.of(!readOnly)),
    });
  }, [readOnly]);

  // Sync external document updates (e.g. checkbox toggle in split pane or conflict resolution)
  // without clobbering echoes of our own local typing.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (initialContent === lastEmittedRef.current) {
      savedContentRef.current = initialContent;
      setDirty(view.state.doc.toString() !== savedContentRef.current);
      return;
    }
    const current = view.state.doc.toString();
    if (initialContent !== current) {
      savedContentRef.current = initialContent;
      lastEmittedRef.current = initialContent;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: initialContent },
      });
      setDirty(false);
    }
  }, [initialContent]);

  const insertSnippet = (before: string, after = '', placeholder = '') => {
    const view = viewRef.current;
    if (!view || readOnly) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    const middle = selected || placeholder;
    const insertText = `${before}${middle}${after}`;
    const anchorStart = from + before.length;
    const anchorEnd = anchorStart + middle.length;
    view.dispatch({
      changes: { from, to, insert: insertText },
      selection: selected || placeholder
        ? { anchor: anchorStart, head: anchorEnd }
        : { anchor: from + before.length },
    });
    view.focus();
  };

  const handleUndo = () => {
    const view = viewRef.current;
    if (!view) return;
    undo(view);
    view.focus();
  };

  const handleRedo = () => {
    const view = viewRef.current;
    if (!view) return;
    redo(view);
    view.focus();
  };

  return (
    <div
      className="flex flex-col h-full min-h-[380px] rounded-2xl bg-[var(--bg-canvas)] shadow-md overflow-hidden"
      data-testid="markdown-editor"
    >
      {/* Editor Toolbar */}
      <div
        style={{ boxShadow: 'var(--header-shadow)' }}
        className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[var(--bg-surface)]"
      >
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => insertSnippet('- [ ] ', '', 'task')}
            disabled={readOnly}
            title="Insert checklist item"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Task</span>
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('[[', ']]', 'note')}
            disabled={readOnly}
            title="Insert wikilink"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">[[]]</span>
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('## ', '', 'Heading')}
            disabled={readOnly}
            title="Insert heading"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('**', '**', 'bold')}
            disabled={readOnly}
            title="Bold"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('`', '`', 'code')}
            disabled={readOnly}
            title="Inline code"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <span className="mx-1 h-4 w-px bg-[var(--fg-app)]/15" aria-hidden="true" />
          <button
            type="button"
            onClick={handleUndo}
            disabled={readOnly}
            title="Undo"
            aria-label="Undo edit"
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={readOnly}
            title="Redo"
            aria-label="Redo edit"
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleVim(!vimMode)}
            aria-pressed={vimMode}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
              vimMode
                ? 'bg-[var(--bg-hover)] text-[var(--accent-primary)]'
                : 'bg-[var(--bg-canvas)] text-[var(--text-muted)] shadow-xs'
            }`}
          >
            Vim {vimMode ? 'On' : 'Off'}
          </button>

          {dirty && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
              Unsaved
            </span>
          )}

          <button
            type="button"
            onClick={() => void triggerSave()}
            disabled={readOnly || saving}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-[var(--button-primary-bg)] hover:opacity-90 disabled:opacity-50 text-[var(--button-primary-fg)] shadow-xs transition-opacity"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* CodeMirror 6 Mount Point */}
      <div ref={hostRef} className="flex-1 min-h-[320px] overflow-hidden" />
    </div>
  );
}
