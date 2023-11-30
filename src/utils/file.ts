import { fileURLToPath } from 'url';
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const filePath = path.join(__dirname,'../docs');

export const outputFilePath = path.join(__dirname,'../docIndex')
