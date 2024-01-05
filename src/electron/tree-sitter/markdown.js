import { getTreeSitterBinding } from '@/electron/tree-sitter/index';

export default getTreeSitterBinding([
  'tree-sitter-markdown',
  'tree_sitter_markdown_binding'
])
export const nodeTypeInfo = getTreeSitterBinding([
  'tree-sitter-markdown',
  'node-types.json'
])
