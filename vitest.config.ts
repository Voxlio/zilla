import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // You might want to add these for better testing
    // coverage: {
    //   provider: 'v8',
    //   reporter: ['text', 'json', 'html'],
    //   exclude: [
    //     'node_modules/',
    //     'src/test/',
    //     '.vite/',
    //     'dist/',
    //     'cypress/',
    //     '.{idea,git,cache,output,temp}',
    //     '**/*.config.[jt]s',
    //     '**/*.d.ts'
    //   ]
    // }
  },
});