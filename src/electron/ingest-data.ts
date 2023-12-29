import { FaissStore } from './faiss';
import ZipLoader from '@/loaders/zip';
import { HttpsProxyAgent } from 'https-proxy-agent';
import path from 'path';
import { outputDir } from '@/config';
import { getApikey, getProxy } from '@/electron/storage';
import fetch from 'node-fetch';

import { Document } from '@/types/document';
import { getPdfDocs } from '@/loaders';
import { getMaxToken, getTokenCount, default as Embeddings } from '@/electron/embeddings';

const embeddingModel = 'text-embedding-ada-002'


const supportedLanguages = [
  ".cpp",
  ".go",
  ".java",
  ".js",
  ".php",
  ".proto",
  ".python",
  ".rst",
  ".ruby",
  ".rust",
  ".scala",
  ".swift",
  ".markdown",
  ".md",
  ".latex",
  ".html",
  ".sol",
  ".kotlin",
  ".pdf",
  ".txt"
]

function splitText(text:string, modelName:string):string[]{
  if(getTokenCount(text) <= getMaxToken(modelName)){
    return [text]
  }
  else{
    const mid = Math.floor(text.length / 2)
    return splitText(
      text.slice(0,mid),
      modelName
    ).concat(
      splitText(
        text.slice(mid),
        modelName
      )
    )
  }
}

async function getDocuments({buffer, filename, filePath}: IngestParams): Promise<Document[]>{
  if(filePath.endsWith('.pdf')){
    return getPdfDocs({buffer, filename, filePath})
  }
  if(filePath.endsWith('.zip')){
    const tasks: Array<Promise<Document[]>> = []
    const files = await new ZipLoader().parse(buffer, path=> {
      return supportedLanguages.reduce((acc, ext)=>{
        return acc || path.endsWith(ext)
      },false)
    })
    for(const file of files){
      const {path,content} = file
      if(path.endsWith('.pdf')){
        tasks.push(
          getPdfDocs({buffer, filename, filePath})
        )
      }
      else{
        tasks.push(
          Promise.resolve(
            splitText(content, embeddingModel).map(text=>{
              return new Document({
                pageContent: text,
                metadata:{
                  source: path
                }
              })
            })
          )
        )
      }
    }
    return Promise.all(tasks).then(docs=>{
      return docs.flat()
    })
  }
  return Promise.reject('unknown file')
}

export default async ({ buffer, filename,filePath }: IngestParams) => {
  const proxy = getProxy() as string;
  const apikey = getApikey() as string;
  try {
    const docs = await getDocuments({
      buffer,
      filename,
      filePath
    })
    const vectorStore = await FaissStore.fromDocuments(docs,
    new Embeddings({
        openAIApiKey: apikey,
        modelName: embeddingModel
      },{
        httpAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
        // @ts-ignore
        fetch
      }
    ));
    const outputFilePath = path.join(outputDir, filename);
    await vectorStore.save(outputFilePath);

  } catch (error) {
    console.log('error', error);
    return Promise.reject(error.code || 'ingest data failed');
  }
};

