import type * as Monaco from 'monaco-editor';

export function registerAdaLanguage(monaco: typeof Monaco) {
  // Register language
  monaco.languages.register({ id: 'ada' });

  // Token provider
  monaco.languages.setMonarchTokensProvider('ada', {
    defaultToken: '',
    tokenPostfix: '.ada',

    keywords: [
      'procedure', 'function', 'package', 'with', 'use', 'is', 'begin', 'end',
      'if', 'then', 'else', 'elsif', 'loop', 'for', 'while', 'return', 'type',
      'subtype', 'record', 'array', 'null', 'true', 'false', 'and', 'or', 'not',
      'in', 'out', 'declare', 'exception', 'raise', 'when', 'others', 'body',
      'private', 'limited', 'abstract', 'tagged', 'new', 'of', 'access', 'all',
      'constant', 'renames', 'separate', 'task', 'protected', 'entry', 'accept',
      'select', 'abort', 'delay', 'terminate', 'exit', 'goto', 'pragma', 'generic',
      'overriding', 'synchronized', 'interface', 'some', 'do', 'at', 'mod', 'rem',
      'xor', 'abs', 'reverse', 'digits', 'delta', 'range', 'case', 'others',
    ],

    typeKeywords: [
      'Integer', 'Float', 'Boolean', 'Character', 'String', 'Natural', 'Positive',
      'Long_Integer', 'Long_Float', 'Short_Integer', 'Duration', 'Wide_Character',
    ],

    operators: [
      ':=', '=', '/=', '<', '<=', '>', '>=', '+', '-', '*', '/', '**',
      '&', '|', '=>', '..', "'", ':', ';', ',', '.', '(', ')',
    ],

    tokenizer: {
      root: [
        // Comments
        [/--.*$/, 'comment'],

        // Strings
        [/"([^"\\]|\\.)*"/, 'string'],

        // Character literals
        [/'.'/, 'string.char'],

        // Numbers
        [/\b\d+(\.\d+)?([eE][+-]?\d+)?\b/, 'number'],
        [/\b16#[0-9a-fA-F]+#\b/, 'number.hex'],

        // Type keywords
        [
          /\b(Integer|Float|Boolean|Character|String|Natural|Positive|Long_Integer|Long_Float|Short_Integer|Duration|Wide_Character)\b/,
          'type',
        ],

        // Keywords
        [
          /\b(procedure|function|package|with|use|is|begin|end|if|then|else|elsif|loop|for|while|return|type|subtype|record|array|null|true|false|and|or|not|in|out|declare|exception|raise|when|others|body|private|limited|abstract|tagged|new|of|access|all|constant|renames|separate|task|protected|entry|accept|select|abort|delay|terminate|exit|goto|pragma|generic|overriding|synchronized|interface|some|do|at|mod|rem|xor|abs|reverse|digits|delta|range|case)\b/i,
          'keyword',
        ],

        // Identifiers
        [/[a-zA-Z_]\w*/, 'identifier'],

        // Whitespace
        [/\s+/, 'white'],

        // Operators
        [/:=|=>|\.\./, 'operator'],
        [/[=<>!+\-*/&|]/, 'operator'],
        [/[;:,.()\[\]{}]/, 'delimiter'],
      ],
    },
  });

  // Define the ada-dark theme
  monaco.editor.defineTheme('ada-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'f59e0b', fontStyle: 'bold' },
      { token: 'type', foreground: 'fb923c' },
      { token: 'string', foreground: '22c55e' },
      { token: 'string.char', foreground: '22c55e' },
      { token: 'number', foreground: '22d3ee' },
      { token: 'number.hex', foreground: '22d3ee' },
      { token: 'comment', foreground: '52525b', fontStyle: 'italic' },
      { token: 'operator', foreground: 'a1a1aa' },
      { token: 'delimiter', foreground: '71717a' },
      { token: 'identifier', foreground: 'f4f4f5' },
    ],
    colors: {
      'editor.background': '#0e0e10',
      'editor.foreground': '#f4f4f5',
      'editor.lineHighlightBackground': '#16161a',
      'editor.selectionBackground': '#f59e0b33',
      'editor.inactiveSelectionBackground': '#f59e0b1a',
      'editorLineNumber.foreground': '#3f3f46',
      'editorLineNumber.activeForeground': '#a1a1aa',
      'editorCursor.foreground': '#f59e0b',
      'editorWhitespace.foreground': '#27272a',
      'editorIndentGuide.background': '#27272a',
      'editorIndentGuide.activeBackground': '#3f3f46',
      'editor.findMatchBackground': '#f59e0b44',
      'editor.findMatchHighlightBackground': '#f59e0b22',
      'editorGutter.background': '#0e0e10',
      'scrollbarSlider.background': '#27272a88',
      'scrollbarSlider.hoverBackground': '#3f3f46aa',
      'minimap.background': '#0e0e10',
    },
  });

  // Soft dark theme — slightly warmer, less contrast
  monaco.editor.defineTheme('ada-soft', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'fbbf24', fontStyle: 'bold' },
      { token: 'type', foreground: 'f97316' },
      { token: 'string', foreground: '4ade80' },
      { token: 'string.char', foreground: '4ade80' },
      { token: 'number', foreground: '67e8f9' },
      { token: 'number.hex', foreground: '67e8f9' },
      { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'operator', foreground: 'cbd5e1' },
      { token: 'delimiter', foreground: '94a3b8' },
      { token: 'identifier', foreground: 'e2e8f0' },
    ],
    colors: {
      'editor.background': '#1a1a2e',
      'editor.foreground': '#e2e8f0',
      'editor.lineHighlightBackground': '#1e1e3a',
      'editor.selectionBackground': '#fbbf2433',
      'editorLineNumber.foreground': '#4b5563',
      'editorLineNumber.activeForeground': '#9ca3af',
      'editorCursor.foreground': '#fbbf24',
      'editorGutter.background': '#1a1a2e',
      'minimap.background': '#1a1a2e',
    },
  });

  // Completion provider
  monaco.languages.registerCompletionItemProvider('ada', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const keywords = [
        'procedure', 'function', 'package', 'begin', 'end', 'is', 'return',
        'if', 'then', 'else', 'elsif', 'loop', 'for', 'while', 'declare',
        'exception', 'raise', 'when', 'others', 'null', 'with', 'use',
      ];

      const suggestions = keywords.map((kw) => ({
        label: kw,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: kw,
        range,
      }));

      return { suggestions };
    },
  });
}
