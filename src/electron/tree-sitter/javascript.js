import { getTreeSitterBinding } from '@/electron/tree-sitter/index';

export default getTreeSitterBinding([
  'tree-sitter-javascript',
  'tree_sitter_javascript_binding'
])
export const nodeTypeInfo = getTreeSitterBinding([
  'tree-sitter-javascript',
  'node-types.json'
])
