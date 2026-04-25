import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ganti 'asset-tracker' dengan nama repo GitHub kamu
export default defineConfig({
  plugins: [react()],
  base: '/asset-management/',
})
