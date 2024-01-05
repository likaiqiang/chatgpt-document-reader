import { getTreeSitterBinding } from '@/electron/tree-sitter/index';

export default getTreeSitterBinding([
  'tree-sitter-rust',
  'tree_sitter_rust_binding'
])
export const nodeTypeInfo = getTreeSitterBinding([
  'tree-sitter-rust',
  'node-types.json'
])
