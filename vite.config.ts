import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env file if exists
    const env = loadEnv(mode, process.cwd(), '');

    // Get API Key from System Environment (Render) OR .env file
    const groqKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY;

    console.log(`Build config: GROQ_API_KEY is ${groqKey ? 'PRESENT' : 'MISSING'}`);

    return {
        plugins: [react()],
        define: {
            'process.env.GROQ_API_KEY': JSON.stringify(groqKey),
            'import.meta.env.GROQ_API_KEY': JSON.stringify(groqKey)
        },
        build: {
            outDir: 'dist',
            sourcemap: false,
            rollupOptions: {
                output: {
                    manualChunks: {
                        'groq': ['groq-sdk'],
                        'pdf': ['pdfjs-dist'],
                        // Removed tesseract.js from here to avoid build errors "Could not resolve entry module"
                        'react-vendor': ['react', 'react-dom'],
                        'markdown': ['react-markdown', 'react-syntax-highlighter']
                    }
                }
            }
        },
        optimizeDeps: {
            include: ['groq-sdk', 'pdfjs-dist']
        },
        server: {
            port: 3000,
            host: true
        },
        preview: {
            port: process.env.PORT ? parseInt(process.env.PORT) : 4173,
            host: true,
            allowedHosts: true
        }
    };
});
