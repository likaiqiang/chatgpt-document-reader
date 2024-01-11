const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const tar = require('tar');
const fsExtra = require('fs-extra')
const os = require('os');


function buildLib({command, cwd, destination}){
  return new Promise((resolve,reject)=>{
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        return reject(`执行的命令出错: ${error}`)
      }

      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);

      // 找到生成的压缩包
      const prebuildsDir = path.join(cwd, 'prebuilds');
      fs.readdir(prebuildsDir, (err, files) => {
        if (err) {
          return reject(`读取目录出错: ${err}`)
        }

        // 找到 .tar.gz 文件
        const tarFile = files.find(file => file.endsWith('.tar.gz'));
        if (!tarFile) {
          return reject('没有找到 .tar.gz 文件')
        }

        // 解压缩文件
        tar.x({
          file: path.join(prebuildsDir, tarFile),
          C: prebuildsDir,
        }, err => {
          if (err) {
            return reject(`解压缩文件出错: ${err}`)
          }
          fsExtra.copy(
            path.join(prebuildsDir,'build','Release'),
            destination
          ).then(resolve)
        });
      });
    });
  })
}

async function buildWasm({ languageName}){
  const command = 'npx tree-sitter build-wasm .'
  const cwd = path.join(__dirname, `./node_modules/tree-sitter-${languageName}`)
  const destination = path.join(__dirname, './src/assets/wasm')
  return new Promise((resolve,reject)=>{
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        return reject(`执行的命令出错: ${error}`)
      }

      console.log(`stdout: tree-sitter-${languageName} generate success`);

      const wasmFile = `tree-sitter-${languageName}.wasm`
      fsExtra.copy(
        path.join(path.join(cwd, wasmFile)),
        path.join(destination, wasmFile)
      ).then(resolve)
    });
  })
}

async function serialPrommise(taskFunc = []){
  return taskFunc.reduce((acc,func)=>{
    return acc.then(()=>{
      return func()
    })
  },Promise.resolve())
}

const buildNodeModulesLib = ()=>{
  return ['javascript','cpp','go','java','php','python','ruby','rust','scala','markdown','html','solidity','kotlin'].map(language=>{
    return buildLib({
      command: 'npx prebuild -r electron -t 26.0.0 --strip',
      cwd: path.join(__dirname, 'node_modules', `tree-sitter-${language}`),
      destination: path.join(__dirname, 'src', 'assets', 'node', `tree-sitter-${language}`)
    })
  })
}

const copyNodeTypes = ()=>{
  return ['javascript','cpp','go','java','php','python','ruby','rust','scala','markdown','html','solidity','kotlin'].map(language=>{
    return fsExtra.copy(
      path.join(__dirname, 'node_modules', `tree-sitter-${language}`, 'src', 'node-types.json'),
      path.join(__dirname, 'src', 'assets', 'node', `tree-sitter-${language}`, 'node-types.json')
    )
  })
}

const buildFaiss = async function(){
  const copyFaiss = async ()=>{
    return fsExtra.copy(
      path.join(__dirname, 'node_modules', 'faiss-node','build', 'Release'),
      path.join(__dirname, 'src', 'assets', 'node', 'faiss-node', 'build')
    )
  }
  if(os.platform() === 'darwin'){
    return new Promise((resolve, reject)=>{
      const command = 'git clone -b v1.7.4 --depth 1 https://github.com/facebookresearch/faiss.git deps/faiss && npm i cmake-js && npm run build'
      exec(command, { cwd: path.join(__dirname,'node_modules','faiss-node') }, (error, stdout, stderr) => {
        if (error) {
          return reject(`执行的命令出错: ${error}`)
        }
        copyFaiss().then(resolve)
      });
    })
  }
  else {
    await copyFaiss()
  }
}

const taskFunc = [
  buildFaiss,
  ()=>{
    return Promise.all(
      ['javascript','cpp','go','java','php','python','ruby','rust','scala','markdown','html','solidity','kotlin'].map(language=> buildWasm({languageName: language}))
    )
  }
]

serialPrommise(taskFunc).then().catch(err=>{
  console.log(err);
})
