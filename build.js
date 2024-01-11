const { exec } = require('child_process');
const path = require('path');
const fsExtra = require('fs-extra')
const os = require('os');
const { rimrafSync } = require('rimraf')

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

const buildFaiss = async function(){
  const copyFaiss = async ()=>{
    return fsExtra.copy(
      path.join(__dirname, 'node_modules', 'faiss-node','build', 'Release'),
      path.join(__dirname, 'src', 'assets', 'node', 'faiss-node', 'build')
    )
  }
  if(os.platform() === 'darwin'){
    return new Promise((resolve, reject)=>{
      rimrafSync(
        path.join(__dirname,'node_modules','faiss-node','deps','faiss')
      )
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

// const taskFunc = [
//   buildFaiss,
//   ()=>{
//     return Promise.all(
//       ['javascript','cpp','go','java','php','python','ruby','rust','scala','markdown','html','solidity','kotlin'].map(language=> buildWasm({languageName: language}))
//     )
//   }
// ]
//
// serialPrommise(taskFunc).then().catch(err=>{
//   console.log(err);
// })

buildFaiss().then()
