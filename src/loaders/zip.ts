import fs from 'fs/promises'
import jszip from 'jszip'
import filepath from 'path'
import { Document } from '@/types/document';
import {existsSync, mkdirSync, writeFileSync} from 'fs'
import { documentsOutputDir } from '@/config';
import { runPython } from '@/utils/shell';

// semantic_splitter_zip.py
const scriptPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? filepath.join(process.cwd(),'src','assets','python_code','semantic_splitter_zip.py') : filepath.join(__dirname,'python_code','semantic_splitter_zip.py')

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
    const foldername = encodeURIComponent(new URL(path).pathname)
    await ZIPLoader.unzip(path, foldername)
    return runPython<string>({
          scriptPath,
          args: ["--path", path],
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
  static async extractAndScan(zip: jszip, foldername:string){
    const files = [];
    for (const fileName of Object.keys(zip.files)) {
      const file = zip.files[fileName];
      if (file.dir) {
        // 如果是文件夹，递归处理
        const folderPath = filepath.join(documentsOutputDir, foldername,fileName);
        if (!existsSync(folderPath)) {
          mkdirSync(folderPath, { recursive: true });
        }
        const subZipContent = await file.async('nodebuffer');
        const subZip = new jszip();
        await subZip.loadAsync(subZipContent);
        const subFilePaths:string[] = await ZIPLoader.extractAndScan(subZip, foldername);
        files.push(...subFilePaths);
      } else {
        // 如果是文件，提取到指定路径
        const filePath = filepath.join(documentsOutputDir, foldername,fileName);
        file.async('nodebuffer').then((content) => {
          writeFileSync(filePath, content);
        });
        files.push(filePath);
      }
    }

    return files;
  }
  static async unzip(zipFilePath: string, foldername?:string): Promise<string[]>{
    if(!foldername){
      foldername = zipFilePath
    }
    return fs.readFile(zipFilePath)
    .then(data => {
      const zip = new jszip();
      return zip.loadAsync(data);
    })
    .then(contents => {
      return ZIPLoader.extractAndScan(contents, foldername)
    })
    .catch(err => {
      throw err;
    });
  }
}
export default ZIPLoader
