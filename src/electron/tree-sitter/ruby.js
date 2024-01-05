import { getTreeSitterBinding } from '@/electron/tree-sitter/index';

export default getTreeSitterBinding([
  'tree-sitter-ruby',
  'tree_sitter_ruby_binding'
])
export const nodeTypeInfo = getTreeSitterBinding([
  'tree-sitter-ruby',
  'node-types.json'
])
