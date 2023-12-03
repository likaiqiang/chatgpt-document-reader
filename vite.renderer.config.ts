import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";

export default defineConfig({
    build:{
        minify:false
    },
    plugins: [
        react()
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    },
    css: {
        postcss: require('./postcss.config')
    },
    optimizeDeps:{
        entries:'src/renderer/index.html'
    }
})
