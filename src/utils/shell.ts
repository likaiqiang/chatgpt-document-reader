import { Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { PythonShell } from 'python-shell';
import { ipcMain } from 'electron';
import { Channel } from '@/types/bridge';
import path from 'path';

const pythonPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? path.join(process.cwd(),'src','assets','python_source','python') : path.join(__dirname,'python_source','python')

interface PythonParams{
  scriptPath: string,
  args: string[],
  socketEvent: string
  signalId?:string
}

export const runPython = async <T>({scriptPath, args, socketEvent, signalId}:PythonParams):Promise<T>=>{
  let _socket:Socket<DefaultEventsMap, DefaultEventsMap> = null
  return new Promise<T>((resolve, reject)=>{
      const onKill = (e:any,id:string)=>{
        if(id === signalId){
          console.log('onKill');
          shell.kill('SIGTERM')
          ipcMain.removeHandler(signalId)
        }
        off()
      }
      const off = (err?:any)=>{
        console.log('off', err);
        if(_socket){
          _socket?.off(socketEvent, onSocketEvent)
          _socket = null
        }
        global.wss?.off('connection', onConnection)
        reject((err ?? 'kill').toString())
      }
      const shell = new PythonShell(scriptPath, {
            pythonPath,
            pythonOptions: ['-u'],
            args
        }).on('message', (message: string) => {
          console.log(message)
        }).on('stderr', (err: string) => {
          console.log(err)
        }).on('error', (err: Error)=>{
          off(err)
        })


        if(signalId){
          ipcMain.once(Channel.sendSignalId, onKill)
        }

        const onSocketEvent = (content: T,callback: (s:string)=>void)=>{
          callback('Message received');
          shell.kill('SIGTERM')
          resolve(content)
        }
        const onConnection = (socket:  Socket<DefaultEventsMap, DefaultEventsMap>)=>{
          console.log('user connected');
          _socket = socket
          socket.once(socketEvent, onSocketEvent);
        }
        global.wss.once('connection', onConnection)
    })
}
