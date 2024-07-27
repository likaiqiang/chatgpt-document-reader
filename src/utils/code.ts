import { getTreeSitterWASMBindingPath } from '@/electron/tree-sitter';
import Parser from 'web-tree-sitter';
import {existsSync} from 'fs'
import { encodingForModel } from 'js-tiktoken';
import { getTokenCount } from '@/electron/embeddings';
import { Document } from "@/types/document";

export const splitCode = async ({code, suffix, metadata}:{code:string, suffix: string, metadata?:{[key: string]:string}}) =>{
  const maxSplitLength = 8191
  const enc = encodingForModel('text-embedding-ada-002')
  // 创建一个解析器
  const languageParser = await getLanguageParser(suffix.slice(1))
  if(languageParser === null) return []
  const parser = new Parser();
  parser.setLanguage(languageParser);
  const tree = parser.parse(code);

  const root = tree.rootNode;

  // 定义一个数组，用来存储拆分后的代码片段
  const codeFragments:Document[] = [];
  // 定义一个变量，用来存储当前的代码片段
  let currentFragment = '';
  // 定义一个变量，用来存储当前的代码片段的字符长度
  let currentLength = 0;

  for (const child of root.children) {
    let text = child.text;

    while (text.length > 0) {
      const fragmentLength = getTokenCount(enc ,text); // 获取当前文本的token计数

      if (currentFragment === '' || currentLength + fragmentLength <= maxSplitLength) {
        // 如果新片段加上当前片段没有超过最大长度，就添加到当前片段
        const chunk = text.substring(0, Math.min(text.length, maxSplitLength - currentLength));
        text = text.substring(chunk.length); // 减少text的长度
        currentFragment += ('\n' + chunk);
        currentLength += getTokenCount(enc ,chunk); // 更新currentLength为chunk的实际token计数
      } else {
        // 如果当前片段已经满了，将其添加到数组并重置当前片段和长度
        codeFragments.push(
          new Document({
            pageContent: currentFragment,
            metadata: metadata || {}
          })
        );
        currentFragment = '';
        currentLength = 0;
        // 注意：在这里不应该做任何有关text的操作。
        // 因为你已经有一个超出maxSplitLength的text部分需要在下一个循环中处理。
      }
    }
  }

  if (currentFragment !== '') {
    // 如果不为空，就将当前的代码片段添加到数组中
    codeFragments.push(
      new Document({
        pageContent: currentFragment,
        metadata: metadata || {}
      })
    );
  }

  return codeFragments;
}

export const getLanguageParser = async (language: string) => {
  await Parser.init({
    locateFile(scriptName: string, scriptDirectory: string) {
      return getTreeSitterWASMBindingPath([scriptName])
    },
  });
  if (language === 'js') language = 'javascript'
  if(language === 'py') language = 'python'
  if(language === 'ts') language = 'typescript'
  if(language ==='cs') language = 'c_sharp'
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
