import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron-renderer'
import path from "path";

export default defineConfig({
    build: {
        lib: {
            entry: 'src/renderer/index.tsx', // 这里可以更改您的渲染进程的入口文件
            name: 'renderer',
            formats: ['cjs'],
        }
    },
    plugins: [
        react(),
        electron()
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    },
    css: {
        postcss: require('./postcss.config')
    }
})
