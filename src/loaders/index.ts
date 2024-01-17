import PDFLoader from '@/loaders/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import path from 'path';
import {Document} from '@/types/document'
import Parser from 'web-tree-sitter';

import {embeddingModel, getTokenCount, getMaxToken} from '@/electron/embeddings'
import { encodingForModel } from 'js-tiktoken';
import type {TiktokenModel} from 'js-tiktoken'
import { getTreeSitterWASMBindingPath } from '@/electron/tree-sitter';



export const getLanguageParser = async (language: string) =>{
  await Parser.init({
    locateFile(scriptName: string, scriptDirectory: string) {
      return getTreeSitterWASMBindingPath([scriptName])
    },
  });
  if(language === 'js') language = 'javascript'
  if(language === 'md') language = 'markdown'
  if(language === 'sol') language = 'solidity'
  if(language === 'py') language = 'python'
  if(language === '.cs') language = 'c_sharp'
  const Lang = await Parser.Language.load(
    getTreeSitterWASMBindingPath([`tree-sitter-${language}.wasm`])
  );
  return Lang
}

export const splitCode = (code:string, languageParser: Parser.Language, modelName: TiktokenModel = embeddingModel) =>{
  const maxSplitLength = getMaxToken(modelName)
  const enc = encodingForModel(modelName)
  // 创建一个解析器
  const parser = new Parser();
  // 设置解析器的语言
  parser.setLanguage(languageParser);
  // 解析代码，得到一个语法树
  const tree = parser.parse(code);
  // 获取语法树的根节点
  console.log('tree',tree);
  const root = tree.rootNode;
  // 定义一个数组，用来存储拆分后的代码片段
  const codeFragments = [];
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
        codeFragments.push(currentFragment);
        currentFragment = '';
        currentLength = 0;
        // 注意：在这里不应该做任何有关text的操作。
        // 因为你已经有一个超出maxSplitLength的text部分需要在下一个循环中处理。
      }
    }
  }

  if (currentFragment !== '') {
    // 如果不为空，就将当前的代码片段添加到数组中
    codeFragments.push(currentFragment);
  }

  return codeFragments;
}


export const getTextDocs = async ({buffer, filePath}: IngestParams)=>{
  const rawDocsArray = [
      new Document({
        pageContent: buffer as string,
        metadata:{
          source: filePath
        }
      })
  ]
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
  });
  return await textSplitter.splitDocuments(rawDocsArray);
}


export const getPdfDocs = async ({buffer, filename}: IngestParams)=>{
  const rawDocsArray = await new PDFLoader().parse(buffer as Buffer, { source: filename });
  /* Split text into chunks */
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
  });
  return await textSplitter.splitDocuments(rawDocsArray);
}
export const getCodeDocs = async ({buffer, filePath}: IngestParams)=>{
  const ext = path.extname(filePath);
  const Parser = await getLanguageParser(
      ext.slice(1)
  );
  const chunks = splitCode(buffer as string, Parser);
  const docs: Document[] = chunks.map(chunk=>{
    return new Document({
      pageContent: chunk,
      metadata:{
        source: filePath
      }
    })
  })
  return docs
}

