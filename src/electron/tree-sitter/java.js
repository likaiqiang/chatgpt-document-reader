import { getTreeSitterBinding } from '@/electron/tree-sitter/index';

export default getTreeSitterBinding([
  'tree-sitter-java',
  'tree_sitter_java_binding'
])
export const nodeTypeInfo = getTreeSitterBinding([
  'tree-sitter-java',
  'node-types.json'
])
