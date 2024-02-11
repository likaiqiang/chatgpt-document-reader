//@ts-ignore
import {FindInPage} from '@/lib/electron-find'

let findInPage:FindInPage = null

window.chatBot.onFind(()=>{
  if(!findInPage){
    findInPage = new FindInPage({
        findInPage: window.chatBot.findInPage,
        stopFindInPage: window.chatBot.stopFindInPage,
        onFoundInPageResult: window.chatBot.onFoundInPageResult
      }, {
        parentElement: document.getElementById('app') || document.body,
        setSearchBoxSize: window.chatBot.setSearchBoxSize,
        closeSearchWindow: ()=>{
          window.chatBot.stopFindInPage({action:'clearSelection'}).then()
          findInPage.destroy()
          findInPage = null
          window.chatBot.closeSearchWindow().then()
        }
      })
  }
  findInPage.openFindWindow()
})


