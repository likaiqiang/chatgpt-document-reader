import { getTreeSitterWASMBindingPath } from '@/electron/tree-sitter';
import Parser from 'web-tree-sitter';
import path from 'path';
import {existsSync} from 'fs'

// const getTreeSitterWASMBindingPath = (paths:string[] = [])=>{
//     const bp =  paths.reduce(
//       (acc,p)=>{
//           acc = path.join(acc,p)
//           return acc
//       },
//       'D:\\pro\\pdf-chatbot\\src\\assets\\wasm'
//     )
//     return bp
// }

export const getLanguageParser = async (language: string) => {
  await Parser.init({
    locateFile(scriptName: string, scriptDirectory: string) {
      return getTreeSitterWASMBindingPath([scriptName])
    },
  });
  if (language === 'js') language = 'javascript'
  if(existsSync(getTreeSitterWASMBindingPath([`tree-sitter-${language}.wasm`]))){
    return await Parser.Language.load(
      getTreeSitterWASMBindingPath([`tree-sitter-${language}.wasm`])
    )
  }
  return null
}
interface Definition {
  type: string;
  name: string;
  startPosition: { row: number, column: number };
  endPosition: { row: number, column: number };
  code:string
}

function collectDefinitions(node: Parser.SyntaxNode, result:Definition[] = [], sourceCode:string) {
    const type = node.type;
    if (type === 'function_declaration' || type === 'class_declaration' || type === 'method_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          // start_byte = child.start_byte
          //       end_byte = child.end_byte
            result.push({
                type: type === 'class_declaration' ? 'Class' : 'Function',
                name: nameNode.text,
                code: sourceCode.slice(node.startIndex, node.endIndex),
                startPosition: node.startPosition,
                endPosition: node.endPosition
            });
        }
    }
    // Recursively collect definitions in child nodes
    for (let i = 0; i < node.childCount; i++) {
        collectDefinitions(node.child(i), result, sourceCode);
    }
    return result;
}

export const extractFunctionsAndClasses = async (code: string, language: string): Promise<Definition[]> => {
  console.log('extractFunctionsAndClasses', language, code);
  const languageParser = await getLanguageParser(language);
    if(languageParser === null) return []
    const parser = new Parser();
    parser.setLanguage(languageParser);
    const tree = parser.parse(code);
    return collectDefinitions(tree.rootNode, [], code);
}
