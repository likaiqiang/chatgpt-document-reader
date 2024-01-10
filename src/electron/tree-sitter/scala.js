import { getTreeSitterBinding } from '@/electron/tree-sitter/index';

export default getTreeSitterBinding([
  'tree-sitter-scala',
  'tree_sitter_scala_binding'
])
export const nodeTypeInfo = getTreeSitterBinding([
  'tree-sitter-scala',
  'node-types.json'
])
