import { getTreeSitterBinding } from '@/electron/tree-sitter/index';

export default getTreeSitterBinding([
  'tree-sitter-python',
  'tree_sitter_python_binding'
])
export const nodeTypeInfo = getTreeSitterBinding([
  'tree-sitter-python',
  'node-types.json'
])
