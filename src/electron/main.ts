import {app, BrowserWindow, dialog, ipcMain, Menu} from 'electron'
import type {MenuItemConstructorOptions} from 'electron'
import {Channel} from "@/types/bridge";
// import "web-streams-polyfill/es6";
import ingestData from './ingest-data'
import fsPromise from "node:fs/promises";
import path from 'path'
import chat from "./chat";
import  fs from 'fs';
import { outputDir } from '@/config';
import prompt from './prompt'
import {
  setApikey as setLocalApikey,
  setProxy as setLocalProxy,
  getApikey as getLocalApikey,
  getProxy as getLocalProxy
} from './storage'


let mainWindow: BrowserWindow = null

async function setapikey(){
  return prompt({
    label:'please enter openai_api_key',
    value: getLocalApikey() || '',
    inputAttrs: {
      type: 'text'
    },
    type: 'input'
  })
    .then((r) => {
      if(r === null) {
        return Promise.reject(new Error('user cancelled'))
      } else {
        console.log('result', r);
        setLocalApikey(r)
        return Promise.resolve()
      }
    })
}
async function setproxy(){
  return prompt({
    label:'please enter proxy url',
    value: getLocalProxy() || '',
    inputAttrs: {
      type: 'url',
      placeholder:'http://127.0.0.1:7890'
    },
    type: 'input'
  })
    .then((r) => {
      if(r === null) {
        return Promise.reject(new Error('user cancelled'))
      } else {
        console.log('result', r);
        setLocalProxy(r)
        return Promise.resolve()
      }
    })
}

function setCustomMenu() {
  // 定义一个菜单模板，是一个数组，每个元素是一个菜单对象
  const template:MenuItemConstructorOptions[] = [
    {
      // 菜单的标签，显示在菜单栏上
      label: 'Setting',
      // 菜单的子菜单，是一个数组，每个元素是一个菜单项对象
      submenu: [
        {
          label: 'OPENAI_API_KEY',
          click() {
            setapikey().then()
          }
        },
        {
          label: 'Proxy',
          click() {
            setproxy().then()
          }
        }
      ]
    },
  ]

  // 使用Menu.buildFromTemplate方法，根据模板创建一个菜单对象
  const menu = Menu.buildFromTemplate(template)
  // 使用Menu.setApplicationMenu方法，将菜单对象设置为应用程序的菜单
  Menu.setApplicationMenu(menu)
}

function findSubdirs (dir:string) {
  // 定义一个空数组，用于存放符合条件的子目录
  const subdirs:{filename:string, birthtime: Date}[] = []

  // 读取 dir 目录下的所有文件和文件夹，返回一个数组
  const files = fs.readdirSync(dir)

  // 遍历数组中的每个元素
  for (const file of files) {
    // 拼接 dir 和 file，得到完整的路径
    const path = dir + '/' + file

    const stat = fs.statSync(path)
    // 判断 path 是否是一个文件夹，如果是，继续执行
    if (stat.isDirectory()) {
      // 读取 path 文件夹下的所有文件和文件夹，返回一个数组
      const subfiles = fs.readdirSync(path)

      // 判断 subfiles 数组是否非空，如果是，继续执行
      if (subfiles.length > 0) {
        // 判断 subfiles 数组是否包含 docstore.json 和 faiss.index 两个文件，如果是，继续执行
        if (subfiles.includes('docstore.json') && subfiles.includes('faiss.index')) {
          // 将 path 添加到 subdirs 数组中
          subdirs.push({
            filename: file,
            birthtime: stat.birthtime
          })
        }
      }
    }
  }
  // 返回 subdirs 数组
  return subdirs
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  ipcMain.handle(Channel.selectFile, async ()=>{
    const {filePaths} = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters:[
        {name:'pdf', extensions:['pdf']}
      ]
    })
    return filePaths
  })
  ipcMain.handle(Channel.ingestdata, async (e,filePaths:string[])=>{
    if(filePaths.length){
      const buffer = await fsPromise.readFile(filePaths[0])
      const filename = filePaths[0].split(path.sep).pop()
      await ingestData({buffer, filename: filename!})
      return {filename}
    }
    return Promise.reject(new Error('no file select'))
  })

  ipcMain.handle(Channel.chat,  async (e,{question, history, filename})=>{
    return chat({question, history, filename})
  })
  ipcMain.handle(Channel.resources,()=>{
    return findSubdirs(outputDir)
  })

  ipcMain.handle(Channel.checkproxy, ()=>{
    const proxy = getLocalProxy() || ''
    if(proxy) return Promise.resolve()
    return setproxy()
  })
  ipcMain.handle(Channel.checkapikey, ()=>{
    const apikey = getLocalApikey() || ''
    if(apikey) return Promise.resolve()
    return setapikey()
  })

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
  setCustomMenu()
  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
