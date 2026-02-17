import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';

import { miaodaDevPlugin } from "miaoda-sc-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), svgr({
    svgrOptions: {
      icon: true, exportType: 'named', namedExport: 'ReactComponent',
    },
  }), miaodaDevPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/wp-api': {
        target: 'https://digitmarketus.com/Bhairavi/wp-json/crm/v1',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/wp-api/, ''),
      },
    },
  },
});
