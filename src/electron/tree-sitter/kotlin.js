import { getTreeSitterBinding } from '@/electron/tree-sitter/index';

export default getTreeSitterBinding([
  'tree-sitter-kotlin',
  'tree_sitter_kotlin_binding'
])
export const nodeTypeInfo = getTreeSitterBinding([
  'tree-sitter-kotlin',
  'node-types.json'
])
