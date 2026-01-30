import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load environment variables from system (Render.com)
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        define: {
            // Pass GROQ_API_KEY for the Groq SDK
            'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY)
        },
        build: {
            outDir: 'dist',
            sourcemap: false,
            rollupOptions: {
                output: {
                    manualChunks: {
                        // Split large dependencies for better caching
                        'groq': ['groq-sdk'],
                        'pdf': ['pdfjs-dist'],
                        'ocr': ['tesseract.js'],
                        'react-vendor': ['react', 'react-dom'],
                        'markdown': ['react-markdown', 'react-syntax-highlighter']
                    }
                }
            }
        },
        optimizeDeps: {
            include: ['groq-sdk', 'pdfjs-dist', 'tesseract.js']
        },
        server: {
            port: 3000,
            host: true
        },
        preview: {
            port: process.env.PORT ? parseInt(process.env.PORT) : 4173,
            host: true,
            allowedHosts: 'all'
        }
    };
});
