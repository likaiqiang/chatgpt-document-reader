import filepath from 'path';
import fs from 'fs'
import {PythonShell} from 'python-shell';
import { Document } from "@/types/document";
import { runPython } from '@/utils/shell';

// eslint-disable-next-line
const pythonPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? filepath.join(process.cwd(),'src','assets','python_source','python') : filepath.join(__dirname,'python_source','python')
const scriptPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? filepath.join(process.cwd(),'src','assets','python_code','semantic_splitter_text.py') : filepath.join(__dirname,'python_code','semantic_splitter_text.py')

class TextLoader {
    async parse(path:string, signalId?:string): Promise<Document<Record<string, any>>[]>{
        return runPython<string>({
          scriptPath,
          args: ["--path", path],
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
