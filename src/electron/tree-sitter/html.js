import { getTreeSitterBinding } from '@/electron/tree-sitter/index';

export default getTreeSitterBinding([
  'tree-sitter-html',
  'tree_sitter_html_binding'
])
export const nodeTypeInfo = getTreeSitterBinding([
  'tree-sitter-html',
  'node-types.json'
])
