import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@src': resolve(__dirname, 'src'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@locales': resolve(__dirname, 'src/locales'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@components': resolve(__dirname, 'src/components'),
      '@types': resolve(__dirname, 'src/types'),
    },
  },
});
