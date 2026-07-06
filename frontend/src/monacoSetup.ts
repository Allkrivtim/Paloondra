// @monaco-editor/react fetches Monaco from a CDN (jsdelivr) by default. That
// contradicts this panel's "no external dependencies beyond your own server
// and Modrinth" design and simply doesn't work on networks that block
// arbitrary CDNs - so Monaco is bundled and self-hosted instead, the same
// way every other asset in this app is. Import this once, before any
// <Editor> mounts (done in each editor component), so the loader is
// configured first.
//
// Importing the top-level `monaco-editor` package pulls in EVERY bundled
// language (60+, including things like abap/solidity/powerquery we'll
// never use) - several MB even gzipped. Importing the core editor API plus
// only the specific basic-language contributions this app actually uses
// (matching monacoLanguageFor in components/sftp/format.ts) keeps this to
// what's needed: json/yaml/js/ts/xml/shell/ini/markdown syntax highlighting.
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
// JSON is only shipped as an advanced "language service" (schema validation
// etc.), not a basic-language - still far lighter than the full bundle.
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

// A single generic worker handles tokenization/basic editing for every
// language we use - we don't enable language-service features
// (autocomplete, schema validation) that would need the dedicated
// per-language workers (json.worker, ts.worker, etc).
self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

loader.config({ monaco });
