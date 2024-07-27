import fs from 'fs/promises'
import filepath from 'path'
import { Document } from '@/types/document';
import {existsSync, mkdirSync, writeFileSync} from 'fs'
import { documentsOutputDir } from '@/config';
import { runPython } from '@/utils/shell';
import { getEmbeddingConfig, getProxy } from '@/electron/storage';
import { getProxyAgent } from '@/utils/default';
import { Open } from 'unzipper';
import { rimraf } from 'rimraf';

// semantic_directory.py
const scriptPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? filepath.join(process.cwd(),'src','assets','python_code','semantic_directory.py') : filepath.join(__dirname,'python_code','semantic_directory.py')

class ZIPLoader{
  constructor() {
    if(!existsSync(documentsOutputDir)){
      mkdirSync(documentsOutputDir,{recursive: true})
    }
  }
  static promiseAllWithConcurrency<T>(task:(()=>Promise<T[]>)[] = [],option = {limit: 3}): Promise<T[]>{

    const newTask = []
    for(let i=0;i<task.length;i+=option.limit){
        const tmp = []
        for(let j=i;j<i+option.limit;j++){
            task[j] && tmp.push(task[j])
        }
        newTask.push(tmp)
    }
    return newTask.reduce((acc,tmp)=>{
        return acc.then((preRes)=>{
          return Promise.all(
            tmp.map(t=>{
                return t()
            })
          ).then(res=>{
            return [...preRes, ...res.flat()]
          })
        })
    },Promise.resolve([]))
  }
  async parse(path:string): Promise<Document[]>{
    const embeddingConfig = getEmbeddingConfig()
    const proxy = getProxy() as string;
    const args = ["--path", path, '--embedding_api_key', embeddingConfig.apiKey, '--embedding_api_base', embeddingConfig.baseUrl]
    if(getProxyAgent(embeddingConfig.enableProxy, proxy)){
      args.push('--proxy', proxy)
    }
    const stat = await fs.stat(path)
    if(stat.isFile()){
      const foldername = encodeURIComponent(new URL(path).pathname)
      await ZIPLoader.unzip({
        zipFilePath: path,
        foldername
      })
    }
    return runPython<string>({
          scriptPath,
          args,
          socketEvent:'split_zip_result'
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
  static async unzip({zipFilePath, foldername}:{zipFilePath:string, foldername:string}): Promise<void>{
    const dirname = filepath.dirname(zipFilePath)
    return Open.file(zipFilePath).then(d=>{
        return d.extract({ path: documentsOutputDir }).then(()=>{
          const originfoldername = d.files[0].path.split(filepath.sep)[0];
          if(originfoldername !== foldername){
           fs.rename(
              filepath.join(dirname, originfoldername),
              filepath.join(dirname, foldername)
           )
          }
          rimraf.sync(zipFilePath)
        })
      })
  }
}
export default ZIPLoader