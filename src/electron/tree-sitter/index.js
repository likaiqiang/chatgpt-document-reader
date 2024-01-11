const path = require('path')


export const getTreeSitterWASMBindingPath = (paths = [])=>{
    const bp =  paths.reduce(
      (acc,p)=>{
          acc = path.join(acc,p)
          return acc
      },
      // eslint-disable-next-line
      MAIN_WINDOW_VITE_DEV_SERVER_URL ? path.join(process.cwd(),'src','assets','wasm') : path.join(__dirname,'wasm')
    )
    return bp
}
