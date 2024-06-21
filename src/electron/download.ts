import fs from 'fs/promises';
import { existsSync, mkdirSync,createWriteStream } from 'fs';
import {fetch, ProxyAgent} from 'undici'
import os from 'os';
import filepath from 'path';
import ZIPLoader from '@/loaders/zip';
import { documentsOutputDir } from '@/config';

interface GitHubInfo {
  author?: string,
  repository?: string,
  branch?: string,
  rootName?: string,
  resPath?: string,
  urlPrefix?: string,
  urlPostfix?: string
}

interface Params{
  url: string,
  downloadFileName?: string,
  proxy?: string
}

export class GitHub {
  url: string;
  downloadFileName: string;
  info: GitHubInfo = {};
  private requestedPromises: (()=>Promise<{ path: string, data: string }[]>)[] = [];
  private dirPaths: string[] = [];
  private proxy:ProxyAgent
  downloadedFiles: string[]

  constructor({url, downloadFileName,proxy}:Params) {
    this.url = url;
    this.downloadFileName = downloadFileName;
    if(this.downloadFileName === undefined){
      this.downloadFileName = encodeURIComponent(new URL(url).pathname)
    }
    this.proxy = proxy ? new ProxyAgent(proxy) : undefined
    this.info = this.getParsedInfo();
    this.downloadedFiles = []
    if(!existsSync(documentsOutputDir)){
      mkdirSync(documentsOutputDir,{recursive: true})
    }
  }
  async downloadFile(url:string){
    return new Promise((resolve, reject) => {
      fetch(url,{
        dispatcher: this.proxy,
        headers:{
          Accept:"application/json, text/plain, */*",
          Origin:"https://minhaskamal.github.io",
          Referer:"https://minhaskamal.github.io/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
        }
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`请求失败: ${response.statusText}`);
          }
          const localFilePath = filepath.join(documentsOutputDir, this.downloadFileName);
          const fileStream = createWriteStream(localFilePath);
          // response.body.pipe(fileStream);
          fileStream.on('finish', () => {
            this.downloadedFiles.push(localFilePath)
            resolve(`文件已保存到: ${localFilePath}`);
          });
        })
        .catch(error => {
          reject(error.toString());
        });
    });
  }
  private getFile(path: string, url: string) {
    this.requestedPromises.push(()=>{
      return fetch(url,{
        dispatcher: this.proxy,
        headers:{
          Accept:"application/json, text/plain, */*",
          Origin:"https://minhaskamal.github.io",
          Referer:"https://minhaskamal.github.io/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
        }
      }).then(res => res.text()).then(file => {
        return [{
          path,
          data: file
        }];
      });
    });
  }

  private async mapFileAndDirectory() {
    return fetch(this.info.urlPrefix + this.dirPaths.pop() + this.info.urlPostfix,{
      dispatcher: this.proxy,
      headers:{
        Origin:"https://minhaskamal.github.io",
        Referer:"https://minhaskamal.github.io/",
        "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
      }
    }).then(response => response.json()).then(async (response: any[]) => {
      for (let i = response.length - 1; i >= 0; i--) {
        if (response[i].type == 'dir') {
          this.dirPaths.push(response[i].path);

        } else {
          if (response[i].download_url) {
            this.getFile(response[i].path,
              response[i].download_url
            );
          } else {
            console.log(response[i]);
          }
        }
      }

      if (this.dirPaths.length <= 0) {
        await this.downloadFiles();
      } else {
        await this.mapFileAndDirectory();
      }
    });
  }

  private async downloadFiles() {
    const outputDir = filepath.join(documentsOutputDir, this.downloadFileName);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    const files = await ZIPLoader.promiseAllWithConcurrency<{path:string, data: string}>(this.requestedPromises,{limit:100});

    return Promise.all(
      files.map(file => {
        const fp = filepath.join(outputDir, file.path.substring(decodeURI(this.info.resPath).length + 1))
        const dirPath = filepath.dirname(fp)
        if(!existsSync(dirPath)){
          mkdirSync(dirPath, {recursive: true})
        }
        return fs.writeFile(
          fp,
          Buffer.from(file.data)
        ).then(()=>{
          this.downloadedFiles.push(fp)
        })
      })
    )
  }

  getParsedInfo() {
    const repoPath = new URL(this.url).pathname;
    const splitPath = repoPath.split('/');
    const [_,author,repository,__ , branch] = splitPath;
    const rootName = splitPath[splitPath.length-1];

    const repoInfo = {
      author,
      repository,
      branch,
      rootName,
      resPath: '',
      urlPrefix: `https://api.github.com/repos/${author}/${repository}/contents/`,
      urlPostfix: `?ref=${branch}`
    };
    if(branch){
      repoInfo.resPath = repoPath.substring(
        repoPath.indexOf(splitPath[4])+splitPath[4].length+1
      )
    }
    if (!repoInfo.resPath || repoInfo.resPath == '') {
      if (!repoInfo.branch || repoInfo.branch == '') {
        repoInfo.branch = 'master';
      }
    }
    return repoInfo;
  }

  private async downloadDir() {
    this.dirPaths.push(this.info.resPath);
    await this.mapFileAndDirectory();
  }

  async downloadZippedFiles() {
    if (!this.info.resPath || this.info.resPath == '') {
      const downloadUrl = 'https://github.com/' + this.info.author + '/' +
        this.info.repository + '/archive/' + this.info.branch + '.zip';
      if(!this.downloadFileName.endsWith('.zip')){
        this.downloadFileName += '.zip'
      }
      await this.downloadFile(downloadUrl);
      return ZIPLoader.unzip(
        filepath.join(documentsOutputDir, this.downloadFileName)
      ).then(files=>{
        this.downloadedFiles.push(...files)
      })
    } else {
      const response = await fetch(this.info.urlPrefix + this.info.resPath + this.info.urlPostfix,{
        dispatcher: this.proxy,
        headers:{
          Origin:"https://minhaskamal.github.io",
          Referer:"https://minhaskamal.github.io/",
          "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
        }
      }).then(res => res.json());
      if (response instanceof Array) {
        return this.downloadDir();
      } else {
        return this.downloadFile((response as {download_url:string}).download_url);
      }
    }
  }
}

// const dl = new GitHub(
//   {
//     url:'https://github.com/lodash/lodash/blob/main/src',
//     downloadFileName: 'lodash',
//     proxy:'http://127.0.0.1:7890'
//   }
// )
// dl.downloadZippedFiles().then(()=>{
//   console.log(dl.downloadedFiles);
// })


