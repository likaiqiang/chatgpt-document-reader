import path from 'path';
import { app } from 'electron';
import fs from 'fs'
const userPath = app.getPath('userData')

export const outputDir = path.join(userPath,'.faisscache')
export const documentsOutputDir = path.join(userPath,'.documents')

if(!fs.existsSync(outputDir)){
  fs.mkdirSync(outputDir,{recursive: true})
}
if(!fs.existsSync(documentsOutputDir)){
  fs.mkdirSync(documentsOutputDir,{recursive: true})
}
