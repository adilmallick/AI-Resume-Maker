import React from 'react';
import Editor from '@monaco-editor/react';

interface LaTeXEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  readOnly?: boolean;
}

export default function LaTeXEditor({ value, onChange, readOnly = false }: LaTeXEditorProps) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
      <Editor
        height="100%"
        defaultLanguage="latex"
        theme="vs-dark"
        value={value}
        onChange={onChange}
        options={{
          readOnly,
          minimap: { enabled: false },
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          fontSize: 14,
        }}
      />
    </div>
  );
}
