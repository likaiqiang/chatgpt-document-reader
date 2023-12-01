import { defineConfig } from 'vite';
import path from "path";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    // Some libs that can run in both Web and Node.js, such as `axios`, we need to tell Vite to build them in Node.js.
    browserField: false,
    mainFields: ['module', 'jsnext:main', 'jsnext'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build:{
    minify: false,
    sourcemap: true,
    lib: {
      entry: 'src/electron/main.ts', // 这里可以更改您的渲染进程的入口文件
      name: 'main',
      formats: ['cjs'],
    }

  }
});
