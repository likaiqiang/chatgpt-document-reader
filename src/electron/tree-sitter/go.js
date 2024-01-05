import { getTreeSitterBinding } from '@/electron/tree-sitter/index';

export default getTreeSitterBinding([
  'tree-sitter-go',
  'tree_sitter_go_binding'
])
export const nodeTypeInfo = getTreeSitterBinding([
  'tree-sitter-go',
  'node-types.json'
])
