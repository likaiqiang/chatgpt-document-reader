import {
  app,
  BrowserWindow,
  BrowserView,
  dialog,
  ipcMain,
  Menu,
  shell,
  globalShortcut,
  RenderProcessGoneDetails,
  Result,
  screen
} from 'electron';
import electronSquirrelStartup from 'electron-squirrel-startup';
import type { MenuItemConstructorOptions } from 'electron';
import contextMenu from 'electron-context-menu';
import cloneDeep from 'lodash.clonedeep';
import { rimraf } from 'rimraf';

import { watch } from 'fs';
import { Channel } from '@/types/bridge';
import { mainSend, fetchModels, mainOn } from '@/utils/default';

import {
  getRemoteFiles,
  ingestData,
  supportedDocuments
} from './electron/ingest-data';
import path from 'path';
import chat from './electron/chat';
import fs from 'fs';
import { outputDir } from '@/config';
import {
  setApiConfig as setLocalApikey,
  setProxy as setLocalProxy,
  getApiConfig as getLocalApikey,
  getProxy as getLocalProxy,
  getModel,
  setModal,
  store as electronStore
} from './electron/storage';
import {
  FindInPageParmas,
  StopFindInPageParmas
} from '@/types/webContents';

let mainWindow: BrowserWindow = null,
  searchWindow: BrowserView = null;

let currentRenderFile = '';

function setCustomMenu() {
  // 定义一个菜单模板，是一个数组，每个元素是一个菜单对象
  const template: MenuItemConstructorOptions[] = [
    {
      // 菜单的标签，显示在菜单栏上
      label: '设置',
      // 菜单的子菜单，是一个数组，每个元素是一个菜单项对象
      submenu: [
        {
          label: 'api配置',
          click() {
            mainSend(mainWindow, Channel.apiConfigChange);
          }
        },
        {
          label: '选择模型',
          submenu: [
            {
              label: 'gpt-4-1106-preview'.toUpperCase(),
              type: 'radio',
              checked: getModel() === 'gpt-4-1106-preview',
              click() {
                setModal('gpt-4-1106-preview');
              }
            },
            {
              label: 'gpt-3.5-turbo-1106'.toUpperCase(),
              type: 'radio',
              checked: getModel() === 'gpt-3.5-turbo-1106',
              click() {
                setModal('gpt-3.5-turbo-1106');
              }
            }
          ]
        },
        {
          label: '打开向量缓存目录',
          click() {
            shell.openPath(outputDir).then();
          }
        }
      ]
    }
  ];

  // 使用Menu.buildFromTemplate方法，根据模板创建一个菜单对象
  const menu = Menu.buildFromTemplate(template);
  // 使用Menu.setApplicationMenu方法，将菜单对象设置为应用程序的菜单
  mainWindow.setMenu(menu);
  // searchWindow.setMenu(null)
}

function hasRepeat(filename: string) {
  const files = fs.readdirSync(outputDir);
  for (const file of files) {
    const filepath = path.join(outputDir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory() && file === filename) {
      return true;
    }
  }
  return false;
}

function convertChineseToUnicode(str: string) {
  // 创建一个正则表达式，匹配中文字符的范围
  const chineseRegex = /[\u4e00-\u9fa5]/g;
  // 使用replace方法，将匹配的中文字符替换为Unicode转义序列
  const result = str.replace(chineseRegex, function(match) {
    // 获取中文字符的码点
    const codePoint = match.codePointAt(0);
    // 将码点转换为十六进制数，并补齐四位
    const hex = codePoint.toString(16).padStart(4, '0');
    // 返回Unicode转义序列
    return '\\u' + hex;
  });
  // 返回结果字符串
  return result;
}

function findSubdirs(dir: string) {
  // 定义一个空数组，用于存放符合条件的子目录
  const subdirs: { filename: string, birthtime: Date }[] = [];

  // 读取 dir 目录下的所有文件和文件夹，返回一个数组
  const files = fs.readdirSync(dir);

  // 遍历数组中的每个元素
  for (const file of files) {
    // 拼接 dir 和 file，得到完整的路径
    const path = dir + '/' + file;

    const stat = fs.statSync(path);
    // 判断 path 是否是一个文件夹，如果是，继续执行
    if (stat.isDirectory()) {
      // 读取 path 文件夹下的所有文件和文件夹，返回一个数组
      const subfiles = fs.readdirSync(path);

      // 判断 subfiles 数组是否非空，如果是，继续执行
      if (subfiles.length > 0) {
        // 判断 subfiles 数组是否包含 docstore.json 和 faiss.index 两个文件，如果是，继续执行
        if (subfiles.includes('docstore.json') && subfiles.includes('faiss.index')) {
          // 将 path 添加到 subdirs 数组中
          subdirs.push({
            filename: file,
            birthtime: stat.birthtime
          });
        }
      }
    }
  }
  // 返回 subdirs 数组
  return subdirs;
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (electronSquirrelStartup) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  // 当found-in-page匹配出结果
  mainOn<Result>(mainWindow, 'found-in-page', (e, result) => {
    console.log('found-in-page result', result);
    mainSend(searchWindow, Channel.onFoundInPageResult, result);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  mainOn<RenderProcessGoneDetails>(mainWindow, 'render-process-gone', function(event, detailed) {
    //  logger.info("!crashed, reason: " + detailed.reason + ", exitCode = " + detailed.exitCode)
    if (detailed.reason == 'crashed') {
      // relaunch app
      app.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) });
      app.exit(0);
    }
  });

  searchWindow = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  searchWindow.setBounds({ x: 0, y: 0, width: 0, height: 0 });

  mainWindow.setBrowserView(searchWindow);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
  if (SEARCH_WINDOW_VITE_DEV_SERVER_URL) {
    searchWindow.webContents.loadURL(`${SEARCH_WINDOW_VITE_DEV_SERVER_URL}`);
  } else {
    searchWindow.webContents.loadFile(path.join(__dirname, `../renderer/${SEARCH_WINDOW_VITE_NAME}/index.html`));
  }

  contextMenu({
    showSaveImageAs: true,
    window: mainWindow,
    showInspectElement: false,
    // 设置为false，不显示Select All
    showLookUpSelection: false,
    showCopyImage: false,
    showCopyImageAddress: false,
    showServices: false,

    append: () => {
      return [
        {
          label: '清空历史记录',
          visible: true,
          click: () => {
            mainSend(mainWindow, Channel.showClearHistoryModal);
          }
        },
        {
          label: '删除文件',
          visible: true,
          click: () => {
            mainSend(mainWindow, Channel.showDeleteFileModal);
          }
        }
      ];
    }
  });
  ipcMain.handle(Channel.closeSearchWindow, () => {
    console.log('closeSearchWindow');
    searchWindow.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  });
  ipcMain.handle(Channel.selectFile, async () => {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'document', extensions: supportedDocuments.map(ext => ext.slice(1)) }
      ]
    });
    return filePaths;
  });
  ipcMain.handle(Channel.ingestdata, async (e, filePaths: string[]) => {
    try {
      if (filePaths.length) {
        let filename = /^https?/.test(filePaths[0]) ? encodeURIComponent(new URL(filePaths[0]).pathname) : filePaths[0].split(path.sep).pop();

        if (/^https?/.test(filePaths[0])) {
          if (hasRepeat(filename)) {
            return Promise.reject('filename repeat');
          }
          const files = await getRemoteFiles(filePaths[0]);
          await ingestData({ filename: filename, filePath: files });
        } else {
          filename = convertChineseToUnicode(filename);
          if (hasRepeat(filename)) {
            return Promise.reject('filename repeat');
          }
          await ingestData({ filename: filename, filePath: filePaths! });
        }
        return { filename };
      } else {
        return Promise.reject('no file select');
      }
    } catch (e) {
      return Promise.reject(e || 'ingestdata error');
    }
  });

  ipcMain.handle(Channel.chat, async (e, { question, history, filename }) => {
    return chat({ question, history, filename });
  });
  ipcMain.handle(Channel.resources, () => {
    return findSubdirs(outputDir);
  });

  ipcMain.handle(Channel.checkProxy, () => {
    const proxy = getLocalProxy() || '';
    if (proxy) return Promise.resolve();
    return Promise.reject('no proxy');
  });
  ipcMain.handle(Channel.checkApiConfig, () => {
    const config = getLocalApikey();
    if (config.baseUrl && config.apiKey) return Promise.resolve();
    return Promise.reject('no api config');
  });
  ipcMain.handle(Channel.replyApiConfig, (e, config) => {
    setLocalApikey(config);
  });
  ipcMain.handle(Channel.replyProxy, (e, proxy) => {
    setLocalProxy(proxy);
  });
  ipcMain.handle(Channel.requestGetApiConfig, () => {
    return getLocalApikey();
  });
  ipcMain.handle(Channel.requestGetProxy, () => {
    return getLocalProxy();
  });
  ipcMain.handle(Channel.requestTestApi, (e, config) => {
    return fetchModels(config);
  });

  ipcMain.handle(Channel.findInPage, (e, params: FindInPageParmas) => {
    return mainWindow.webContents.findInPage(params.text, params.options);
  });
  ipcMain.handle(Channel.stopFindInPage, (e, params: StopFindInPageParmas) => {
    return mainWindow.webContents.stopFindInPage(params.action);
  });

  ipcMain.handle(Channel.electronStoreSet, (_, key, value) => {
    console.log('electronStoreSet', electronStore);
    key = !key.startsWith('@___PART___') ? ('@___PART___' + key) : key;
    return electronStore.set(key, value);
  });
  ipcMain.handle(Channel.electronStoreGet, (_, key) => {
    key = !key.startsWith('@___PART___') ? ('@___PART___' + key) : key;
    console.log('electronStoreGet', electronStore.get(key));
    return electronStore.get(key) || {};
  });
  ipcMain.handle(Channel.setRenderCurrentFile, (_, file) => {
    currentRenderFile = file;
  });
  ipcMain.handle(Channel.setSearchBoxSize, (_, { width, height }) => {
    console.log('setSearchBoxSize', width, height);
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { scaleFactor } = display;

    const { x, y, width: mainWidth } = mainWindow.getBounds();

    console.log(x, scaleFactor, mainWidth);

    searchWindow.setBounds({
      x: 0,
      y: 0,
      width: parseInt(width) * scaleFactor,
      height: parseInt(height) * scaleFactor
    });

  });
  ipcMain.handle(Channel.replyClearHistory, (e, { filename }) => {
    const renderChatCache = (cloneDeep(electronStore.get('@___PART___chat-cache') || {})) as { [key: string]: object };
    delete renderChatCache[filename];
    electronStore.set('@___PART___chat-cache', renderChatCache);
  });

  ipcMain.handle(Channel.replyDeleteFile, (e, { filename }) => {
    const filepath = path.join(outputDir, filename);
    return rimraf(filepath);
  });

  setCustomMenu();
  // Open the DevTools.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
  watch(outputDir, () => {
    mainSend(mainWindow, Channel.outputDirChange);
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();
  // 注册事件，ctrl + f 唤起关键字查找控件
  mainWindow.on('focus', () => {
    globalShortcut.register('CommandOrControl+F', function() {
      if (searchWindow && searchWindow.webContents) {
        mainSend(searchWindow, Channel.onFound);
      }
    });
  });

  mainWindow.on('blur', () => {
    globalShortcut.unregisterAll();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  globalShortcut.unregisterAll();
});
app.on('quit', () => {
  globalShortcut.unregisterAll();
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
