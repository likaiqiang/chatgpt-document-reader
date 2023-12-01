import path from 'path';
import { app } from 'electron';
const userPath = app.getPath('userData')
export const outputDir = path.join(userPath,'.faisscache')
