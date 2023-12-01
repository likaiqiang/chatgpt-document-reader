import {app, BrowserWindow, dialog, ipcMain} from 'electron'
import {Channel} from "@/types/bridge";
// import "web-streams-polyfill/es6";
import ingestData from './ingest-data'
import fsPromise from "node:fs/promises";
import path from 'path'
import chat from "./chat";
import  fs from 'fs';
import { outputDir } from '@/config';

function findSubdirs (dir:string) {
  // 定义一个空数组，用于存放符合条件的子目录
  const subdirs:string[] = []

  // 读取 dir 目录下的所有文件和文件夹，返回一个数组
  const files = fs.readdirSync(dir)

  // 遍历数组中的每个元素
  for (const file of files) {
    // 拼接 dir 和 file，得到完整的路径
    const path = dir + '/' + file

    // 判断 path 是否是一个文件夹，如果是，继续执行
    if (fs.statSync(path).isDirectory()) {
      // 读取 path 文件夹下的所有文件和文件夹，返回一个数组
      const subfiles = fs.readdirSync(path)

      // 判断 subfiles 数组是否非空，如果是，继续执行
      if (subfiles.length > 0) {
        // 判断 subfiles 数组是否包含 docstore.json 和 faiss.index 两个文件，如果是，继续执行
        if (subfiles.includes('docstore.json') && subfiles.includes('faiss.index')) {
          // 将 path 添加到 subdirs 数组中
          subdirs.push(file)
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
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  ipcMain.handle(Channel.dialog, async ()=>{
    const {filePaths} = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters:[
        {name:'pdf', extensions:['pdf']}
      ]
    })
    if(filePaths.length){
      const buffer = await fsPromise.readFile(filePaths[0])
      const filename = filePaths[0].split(path.sep).pop()
      await ingestData(buffer, filename!)
      return filename
    }
    return Promise.reject(new Error('no file select'))
  })

  ipcMain.handle(Channel.chat,  async (e,{question, history, filename})=>{
    return chat({question, history, filename})
  })
  ipcMain.handle(Channel.resources,()=>{
    return findSubdirs(outputDir).map(file=>{
      return {
        filename: file
      }
    })
  })

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

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
