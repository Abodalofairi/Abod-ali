    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';

    // https://vitejs.dev/config/
    export default defineConfig({
      plugins: [react()],
      build: {
        outDir: 'dist', // المجلد الذي سيتم فيه إنشاء ملفات البناء
        rollupOptions: {
          input: {
            main: 'index.html', // تحديد index.html كنقطة دخول رئيسية
          },
        },
      },
    });
    

