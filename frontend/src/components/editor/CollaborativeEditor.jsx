import { useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useRoomStore, useAuthStore } from '../../store';

const LANGUAGE_MAP = {
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript',
  PYTHON: 'python',
  CPP: 'cpp',
  JAVA: 'java',
  GO: 'go',
  RUST: 'rust',
};

const USER_COLORS = ['#00FF88', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8EDEA', '#C084FC', '#FB923C'];

export default function CollaborativeEditor({ onCodeChange, onCursorMove, readOnly = false }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const { user } = useAuthStore();
  const { code, language, cursors, onlineUsers } = useRoomStore();

  // Assign stable colors to users
  const userColorMap = useRef({});
  const getColor = (userId) => {
    if (!userColorMap.current[userId]) {
      const idx = Object.keys(userColorMap.current).length % USER_COLORS.length;
      userColorMap.current[userId] = USER_COLORS[idx];
    }
    return userColorMap.current[userId];
  };

  // ─── Render remote cursors as Monaco decorations ───────────────────────
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const newDecorations = Object.entries(cursors)
      .filter(([uid]) => uid !== user?.id)
      .map(([uid, cursor]) => {
        const color = getColor(uid);
        const line = Math.max(1, cursor.line || 1);
        const col = Math.max(1, cursor.column || 1);

        return {
          range: new monaco.Range(line, col, line, col + 1),
          options: {
            className: `remote-cursor-${uid}`,
            afterContentClassName: `remote-cursor-label-${uid}`,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        };
      });

    // Inject CSS for each cursor
    Object.entries(cursors).forEach(([uid, cursor]) => {
      if (uid === user?.id) return;
      const color = getColor(uid);
      const label = cursor.username || 'User';
      const styleId = `cursor-style-${uid}`;
      let el = document.getElementById(styleId);
      if (!el) {
        el = document.createElement('style');
        el.id = styleId;
        document.head.appendChild(el);
      }
      el.textContent = `
        .remote-cursor-${uid} { border-left: 2px solid ${color}; }
        .remote-cursor-label-${uid}::after {
          content: '${label}';
          background: ${color};
          color: #0A0E1A;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 2px;
          position: absolute;
          top: -16px;
          white-space: nowrap;
          pointer-events: none;
        }
      `;
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, [cursors, user?.id]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure Monaco theme
    monaco.editor.defineTheme('codesync-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '4A5568', fontStyle: 'italic' },
        { token: 'keyword', foreground: '00C8FF' },
        { token: 'string', foreground: '00FF88' },
        { token: 'number', foreground: 'FFE66D' },
        { token: 'type', foreground: 'C084FC' },
      ],
      colors: {
        'editor.background': '#0A0E1A',
        'editor.foreground': '#E2E8F0',
        'editor.lineHighlightBackground': '#0D1117',
        'editorLineNumber.foreground': '#2A3A4A',
        'editorLineNumber.activeForeground': '#00FF88',
        'editor.selectionBackground': '#00FF8830',
        'editor.inactiveSelectionBackground': '#00FF8815',
        'editorCursor.foreground': '#00FF88',
        'editorIndentGuide.background': '#1E2A3A',
        'editorIndentGuide.activeBackground': '#2A3A4A',
        'scrollbarSlider.background': '#1E2A3A80',
        'scrollbarSlider.hoverBackground': '#2A3A4A80',
      },
    });
    monaco.editor.setTheme('codesync-dark');

    // Cursor position tracking
    editor.onDidChangeCursorPosition((e) => {
      const { lineNumber, column } = e.position;
      onCursorMove?.(lineNumber, column);
    });
  };

  const handleChange = useCallback((value) => {
    if (value !== undefined) onCodeChange?.(value);
  }, [onCodeChange]);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Editor
        height="100%"
        language={LANGUAGE_MAP[language] || 'javascript'}
        value={code}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          fontSize: 13,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontLigatures: true,
          lineHeight: 22,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'line',
          padding: { top: 16, bottom: 16 },
          tabSize: 2,
          wordWrap: 'off',
          automaticLayout: true,
          suggest: { showWords: false },
          quickSuggestions: true,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true },
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-brand-dark">
            <div className="text-brand-green font-mono text-sm animate-pulse">Loading editor...</div>
          </div>
        }
      />
    </div>
  );
}