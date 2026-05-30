import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

// Vite 配置：React + Cesium
export default defineConfig({
  plugins: [
    react(),
    cesium(),
  ],
})
