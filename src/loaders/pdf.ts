import filepath from 'path';
import {PythonShell} from 'python-shell';
import { Document } from "@/types/document";

// eslint-disable-next-line
const pythonPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? filepath.join(process.cwd(),'src','assets','python_source','python.exe') : filepath.join(__dirname,'python_source','python.exe')
const scriptPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? filepath.join(process.cwd(),'src','assets','python_code','split_pdf.py') : filepath.join(__dirname,'python_code','split_pdf.py')


class PDFLoader {
    async parse(path:string): Promise<Document[]>{
        return PythonShell.run(scriptPath, {
            mode:'json',
            pythonPath,
            pythonOptions: ['-u'],
            args:["--path", path]
        }).then((messages: Document[])=>{
            return messages.map(message=>{
                return new Document({
                    pageContent: message.pageContent,
                    metadata: message.metadata
                })
            })
        })
    }
}
export default PDFLoader
