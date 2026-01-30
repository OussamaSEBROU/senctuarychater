
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // تحميل متغيرات البيئة من النظام (Render)
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // تمرير GROQ_API_KEY للنظام
      'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY || "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"),
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    },
    optimizeDeps: {
      include: ['pdfjs-dist', 'tesseract.js'],
    }
  };
});
