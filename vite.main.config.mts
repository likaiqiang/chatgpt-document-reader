import { viteStaticCopy } from 'vite-plugin-static-copy'
import { defineConfig } from 'vite';
import path from "path";

export const checkIncludes = (id:string)=>{
  return ['node_modules/typescript','node_modules/js-tiktoken','node_modules/@babel','node_modules/undici'].reduce((acc, str)=>{
    return acc || id.includes(str)
  },false)
}

export default defineConfig({
  optimizeDeps:{
    exclude:['typescript']
  },
  build:{
    sourcemap: false,
    minify:false,
    rollupOptions:{
      output: {
        manualChunks(id) {
          if(checkIncludes(id)){
            return 'lib'
          }
        }
      }
    }
  },
  publicDir:'./src/assets',
  resolve: {
    // Some libs that can run in both Web and Node.js, such as `axios`, we need to tell Vite to build them in Node.js.
    // mainFields: ['node','module', 'jsnext:main', 'jsnext'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'uuid': 'node_modules/uuid/dist/esm-node/index.js',
      'ws': 'node_modules/ws/index.js'
    },
  },
  plugins:[
    viteStaticCopy({
      targets: [
        {
          src: 'src/loaders/parse',
          dest: './'
        }
      ]
    }),
    // Inspect()
  ]
});
