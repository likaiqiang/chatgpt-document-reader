import path from 'path';
import { app } from 'electron';
import fs from 'fs'
const userPath = app.getPath('userData')

export const outputDir = path.join(userPath,'.faisscache')

fs.mkdirSync(outputDir,{recursive: true})


console.log('outputDir',outputDir);
