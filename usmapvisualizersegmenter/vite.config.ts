import { defineConfig } from 'vitest/config';
import plugin from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [plugin()],
    server: {
        port: 51826,
    },
    test: {
        include: ['src/**/*.test.ts'],
    },
})
