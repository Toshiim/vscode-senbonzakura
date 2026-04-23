import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Parser, Language, Query } from 'web-tree-sitter';

const TOKEN_TYPES = [
  'keyword', 'string', 'comment', 'number', 'operator',
  'type', 'function', 'variable', 'parameter', 'punctuation'
];

const CAPTURE_MAP: Record<string, string> = {
  'keyword': 'keyword',
  'string': 'string',
  'string.special': 'string',
  'comment': 'comment',
  'constant.numeric': 'number',
  'constant.builtin': 'keyword',
  'operator': 'operator',
  'type': 'type',
  'function': 'function',
  'variable': 'variable',
  'variable.parameter': 'parameter',
  'variable.other.member': 'variable',
  'punctuation.bracket': 'punctuation',
  'punctuation.delimiter': 'punctuation',
};

const legend = new vscode.SemanticTokensLegend(TOKEN_TYPES, []);

export async function activate(context: vscode.ExtensionContext) {
  await Parser.init({
    locateFile: () =>
      path.join(context.extensionPath, 'node_modules', 'web-tree-sitter', 'web-tree-sitter.wasm')
  });

  const lang = await Language.load(
    path.join(context.extensionPath, 'tree-sitter-senbonzakura.wasm')
  );

  const parser = new Parser();
  parser.setLanguage(lang);

  const highlightsSrc = fs.readFileSync(
    path.join(context.extensionPath, 'highlights.scm'),
    'utf8'
  );
  const query = new Query(lang, highlightsSrc);

  const provider: vscode.DocumentSemanticTokensProvider = {
    provideDocumentSemanticTokens(document) {
      const tree = parser.parse(document.getText());
      if (!tree) return new vscode.SemanticTokensBuilder(legend).build();

      const builder = new vscode.SemanticTokensBuilder(legend);

	  const captures = query.captures(tree.rootNode);
      console.log('captures count:', captures.length);
      console.log('first 5:', captures.slice(0, 5).map(c => ({ name: c.name, text: c.node.text })));

      for (const { name, node } of captures) {
        const tokenType = CAPTURE_MAP[name];
        if (!tokenType) continue;
        const typeIndex = TOKEN_TYPES.indexOf(tokenType);
        if (typeIndex === -1) continue;
        const start = document.positionAt(node.startIndex);
        const end = document.positionAt(node.endIndex);
        builder.push(new vscode.Range(start, end), TOKEN_TYPES[typeIndex], []);
      }

      return builder.build();
    }
  };

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: 'senbonzakura' },
      provider,
      legend
    )
  );
}

export function deactivate() {}