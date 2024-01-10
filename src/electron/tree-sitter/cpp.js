import { getTreeSitterBinding } from '@/electron/tree-sitter/index';

export default getTreeSitterBinding([
  'tree-sitter-cpp',
  'tree_sitter_cpp_binding'
])
export const nodeTypeInfo = getTreeSitterBinding([
  'tree-sitter-cpp',
  'node-types.json'
])
