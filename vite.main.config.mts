import { viteStaticCopy } from 'vite-plugin-static-copy'
import { defineConfig } from 'vite';
import path from "path";
// https://vitejs.dev/config
export default defineConfig({
  build:{
    sourcemap: false,
    minify:true
  },
  publicDir:'./src/assets',
  resolve: {
    // Some libs that can run in both Web and Node.js, such as `axios`, we need to tell Vite to build them in Node.js.
    mainFields: ['node','module', 'jsnext:main', 'jsnext'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'uuid': 'node_modules/uuid/dist/esm-node/index.js',
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
    })
  ]
});
