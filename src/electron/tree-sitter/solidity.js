import { getTreeSitterBinding } from '@/electron/tree-sitter/index';

export default getTreeSitterBinding([
  'tree-sitter-solidity',
  'tree_sitter_solidity_binding'
])
export const nodeTypeInfo = getTreeSitterBinding([
  'tree-sitter-solidity',
  'node-types.json'
])
