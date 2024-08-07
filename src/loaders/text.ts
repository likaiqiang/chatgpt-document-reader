import filepath from 'path';
import { Document } from "@/types/document";
import { runPython } from '@/utils/shell';
import { getEmbeddingConfig, getProxy } from '@/electron/storage';
import { getProxyAgent } from '@/utils/default';

// eslint-disable-next-line
const pythonPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? filepath.join(process.cwd(),'src','assets','python_source','python') : filepath.join(__dirname,'python_source','python')
const scriptPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? filepath.join(process.cwd(),'src','assets','python_code','semantic_splitter_text.py') : filepath.join(__dirname,'python_code','semantic_splitter_text.py')

class TextLoader {
    async parse(path:string, signalId?:string): Promise<Document<Record<string, any>>[]>{
      const embeddingConfig = getEmbeddingConfig()
      const proxy = getProxy() as string;1
      const args = ["--path", path, '--embedding_api_key', embeddingConfig.apiKey, '--embedding_api_base', embeddingConfig.baseUrl]
      if(getProxyAgent(embeddingConfig.enableProxy, proxy)){
        args.push('--proxy', proxy)
      }
      return runPython<string>({
          scriptPath,
          args,
          socketEvent:'split_text_result',
          signalId
        }).then(json=>{
          const messages = JSON.parse(json) as Document[]
          return messages.map(message=>{
            return new Document({
              pageContent: message.pageContent,
              metadata: message.metadata
            })
          })
        })
    }
}
export default TextLoader
