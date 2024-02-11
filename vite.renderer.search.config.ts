import { defineConfig } from 'vite'
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, 'src','search_window'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
})
