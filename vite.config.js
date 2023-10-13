import liquidTemplate from './plugins/liquid';
import path from 'node:path';
import recursive from 'recursive-readdir';
import { defineConfig } from 'vite';

const fileList = (
  await recursive(path.join(process.cwd(), 'src', 'liquid', 'pages'))
).filter((f) => f.includes('.liquid.html'));

const paths = {
  '@scss': {
    vite: path.resolve(__dirname, 'src/scss'),
    liquid: '/scss/',
  },
  '@asset': {
    vite: path.resolve(__dirname, 'assets/images'),
    liquid: '/',
  },
  '@script': {
    vite: path.resolve(__dirname, 'src/javascripts'),
    liquid: '/javascripts/',
  },
};

export default defineConfig({
  appType: 'mpa',
  publicDir: path.resolve('./public'),
  server: {
    port: 3300,
    host: '0.0.0.0',
  },
  root: './src',
  plugins: [
    liquidTemplate({
      paths,
      output: path.resolve(__dirname, 'dist'),
    }),
  ],
  css: {
    modules: {
      bundle: false,
    },
    preprocessorOptions: {
      scss: {
        modules: false,
      },
    },
  },
  resolve: {
    preserveSymlinks: true,
    extensions: [
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.json',
      '.css',
      '.vue',
      '.mjs',
      '.wasm',
      '.liquid',
      '.html',
      '.scss',
    ],
    alias: Object.fromEntries(
      Object.entries(paths).map(([key, value]) => [key, value.vite])
    ),
  },
  build: {
    assetsInlineLimit: 1,
    cssCodeSplit: true,
    sourcemap: false,
    outDir: '../dist',
    emptyOutDir: true,
    minify: false,
    manifest: false,
    rollupOptions: {
      input: fileList,
      output: {
        compact: true,
        manualChunks: false,
      },
    },
  },
});
