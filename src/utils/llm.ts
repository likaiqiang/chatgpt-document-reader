import path from 'path'
import { PythonShell } from 'python-shell';
import { Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { ipcMain } from 'electron';
import { Channel } from '@/types/bridge';
// eslint-disable-next-line
const pythonPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? path.join(process.cwd(),'src','assets','python_source','python') : path.join(__dirname,'python_source','python')
const scriptPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? path.join(process.cwd(),'src','assets','python_code','llm.py') : path.join(__dirname,'python_code','llm.py')


enum ChatType {
  ERNIE = 'ernie',
  CHATGPT = 'chatgpt'
}
interface LLMParams{
  chatType: ChatType
}
export default class LLM{
  chatType: ChatType = ChatType.ERNIE
  constructor({chatType}: LLMParams) {
    this.chatType = chatType
  }
  async chat(prompt: string, signalId?:string){
    console.log('signalId', signalId);
    let _socket:Socket<DefaultEventsMap, DefaultEventsMap> = null
    return new Promise<string>((resolve, reject)=>{
      if(this.chatType === ChatType.ERNIE){
        const shell = new PythonShell(scriptPath, {
            pythonPath,
            pythonOptions: ['-u'],
            args:["--prompt", prompt]
        }).on('message', (message: string) => {
          console.log(message)
        }).on('stderr', (err: string) => {
          reject(err)
        }).on('error', (err: Error)=>{
          reject(err)
        })

        const onKill = (e:any,id:string)=>{
          if(id === signalId){
            console.log('onKill');
            shell.kill('SIGTERM')
            _socket?.off('llm_response', onLLMResponse)
            global.wss?.off('connection', onConnection)
            ipcMain.removeHandler(signalId)
            reject('kill')
          }
        }

        if(signalId){
          ipcMain.once(Channel.sendSignalId, onKill)
        }

        const onLLMResponse = (content: string,callback: (s:string)=>void)=>{
          callback('Message received');
          resolve(content)
        }
        const onConnection = (socket:  Socket<DefaultEventsMap, DefaultEventsMap>)=>{
          console.log('user connected');
          _socket = socket
          socket.once('llm_response', onLLMResponse);
        }
        global.wss.once('connection', onConnection)
      }
    })
  }
}
