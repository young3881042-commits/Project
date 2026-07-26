import CodeMirror from '@uiw/react-codemirror';
import { vscodeLight } from '@uiw/codemirror-theme-vscode';
import { css as cssLanguage } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { EditorView, keymap } from '@codemirror/view';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';

function extensionForPath(path) {
  if (!path) {
    return 'text';
  }
  const tokens = path.split('/').filter(Boolean);
  const fileName = tokens[tokens.length - 1] || path;
  const index = fileName.lastIndexOf('.');
  if (index === -1 || index === fileName.length - 1) {
    return 'text';
  }
  return fileName.slice(index + 1).toLowerCase();
}

function languageExtensionsForPath(path) {
  const extension = extensionForPath(path);
  switch (extension) {
    case 'py':
      return [python()];
    case 'js':
    case 'jsx':
      return [javascript({ jsx: true })];
    case 'ts':
    case 'tsx':
      return [javascript({ typescript: true, jsx: true })];
    case 'json':
      return [json()];
    case 'md':
      return [markdown()];
    case 'html':
      return [html()];
    case 'css':
      return [cssLanguage()];
    case 'java':
      return [java()];
    case 'xml':
    case 'svg':
      return [xml()];
    case 'yaml':
    case 'yml':
      return [yaml()];
    default:
      return [];
  }
}

const noBlinkCursorTheme = EditorView.theme({
  '.cm-cursor, .cm-dropCursor': {
    display: 'none !important'
  },
  '&.cm-focused .cm-cursor': {
    display: 'none !important'
  }
});

function saveKeymap(onSave) {
  return keymap.of([{
    key: 'Mod-s',
    run: () => {
      if (typeof onSave === 'function') {
        onSave();
      }
      return true;
    }
  }]);
}

export default function CodeEditor({ path, value, onChange, onSave }) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={vscodeLight}
      extensions={[...languageExtensionsForPath(path), noBlinkCursorTheme, saveKeymap(onSave)]}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        autocompletion: true
      }}
    />
  );
}
