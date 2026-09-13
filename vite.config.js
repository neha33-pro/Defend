// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                background: resolve(__dirname, 'src/background/background.js'),
                content: resolve(__dirname, 'src/content/content.js'),
                popup: resolve(__dirname, 'src/popup/popup.html'),
                offscreen: resolve(__dirname, 'src/offscreen/offscreen.js')
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name].[hash].js',
                assetFileNames: 'assets/[name].[ext]'
            }
        },
        target: 'es2022',
        sourcemap: true,
        minify: false
    },
    optimizeDeps: {
        include: ['onnxruntime-web']
    }
});