import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";

export default defineConfig({
    root: path.resolve(__dirname, 'src'),
    build:{
        minify:true
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
    }
})
