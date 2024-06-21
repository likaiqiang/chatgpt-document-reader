import fs from 'fs/promises'
import jszip from 'jszip'
import filepath from 'path'
import { Document } from '@/types/document';
import {existsSync, mkdirSync, writeFileSync} from 'fs'
import PDFLoader from '@/loaders/pdf';
import TextLoader from '@/loaders/text';
import { checkSupportedLanguages } from '@/electron/ingest-data';
import CodeLoader from '@/loaders/code';
import { documentsOutputDir } from '@/config';

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
  async parse(path:string, filter?: (path:string)=>boolean): Promise<Document[]>{
    if(typeof filter === 'undefined'){
      filter = ()=> true
    }
    const files = (await ZIPLoader.unzip(path)).filter(filter)
    const tasks:(()=>Promise<Document[]>)[] = []
    for(const filePath of files){
      if(filePath.endsWith('.pdf')){
        tasks.push(()=>{
          return new PDFLoader().parse(filePath)
        })
      }
      if(filePath.endsWith('.txt')){
        tasks.push(()=>{
          return new TextLoader().parse(path)
        })
      }
      if(checkSupportedLanguages(filePath)){
        tasks.push(()=>{
          return new CodeLoader().parse(filePath)
        })
      }
    }
    return ZIPLoader.promiseAllWithConcurrency<Document>(tasks)
  }
  static async extractAndScan(zip: jszip){
    const files = [];
    const ziploader = new ZIPLoader()
    for (const fileName of Object.keys(zip.files)) {
      const file = zip.files[fileName];
      if (file.dir) {
        // 如果是文件夹，递归处理
        const folderPath = filepath.join(documentsOutputDir, fileName);
        if (!existsSync(folderPath)) {
          mkdirSync(folderPath, { recursive: true });
        }
        const subZipContent = await file.async('nodebuffer');
        const subZip = new jszip();
        await subZip.loadAsync(subZipContent);
        const subFilePaths:string[] = await ZIPLoader.extractAndScan(subZip);
        files.push(...subFilePaths);
      } else {
        // 如果是文件，提取到指定路径
        const filePath = filepath.join(documentsOutputDir, fileName);
        file.async('nodebuffer').then((content) => {
          writeFileSync(filePath, content);
        });
        files.push(filePath);
      }
    }

    return files;
  }
  static async unzip(zipFilePath: string): Promise<string[]>{
    return fs.readFile(zipFilePath)
    .then(data => {
      const zip = new jszip();
      return zip.loadAsync(data);
    })
    .then(contents => {
      return ZIPLoader.extractAndScan(contents)
    })
    .catch(err => {
      throw err;
    });
  }
}
export default ZIPLoader
