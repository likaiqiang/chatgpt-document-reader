import path from 'path'
import {runPython} from '@/utils/shell'
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

    if(this.chatType === ChatType.ERNIE){
      return runPython<string>({
        scriptPath,
        args: ["--prompt", prompt],
        socketEvent:'llm_response',
        signalId
      })
    }
  }
}
