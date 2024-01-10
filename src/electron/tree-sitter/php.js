import { getTreeSitterBinding } from '@/electron/tree-sitter/index';

export default getTreeSitterBinding([
  'tree-sitter-php',
  'tree_sitter_php_binding'
])
export const nodeTypeInfo = getTreeSitterBinding([
  'tree-sitter-php',
  'node-types.json'
])
