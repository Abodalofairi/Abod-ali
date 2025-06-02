import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // إضافة هذا السطر لتحديد المسار الأساسي
  build: {
    outDir: 'dist', // المجلد الذي سيتم فيه إنشاء ملفات البناء
    rollupOptions: {
      input: 'index.html', // تحديد index.html كنقطة دخول رئيسية
    },
  },
});

