import filepath from 'path';
import { Document } from "@/types/document";
import {runPython} from '@/utils/shell'

const scriptPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? filepath.join(process.cwd(),'src','assets','python_code','semantic_splitter_code.py') : filepath.join(__dirname,'python_code','semantic_splitter_code.py')

class CodeLoader {
    async parse(path:string, signalId?:string): Promise<Document<Record<string, any>>[]>{
      return runPython<string>({
        scriptPath,
        args: ["--path", path],
        socketEvent:'split_code_result',
        signalId
      }).then(json=>{
        const messages = JSON.parse(json) as Document[]
        console.log('code messages',messages);
        return messages.map(message=>{
          return new Document({
            pageContent: message.pageContent,
            metadata: message.metadata
          })
        })
      })
    }
}
export default CodeLoader
