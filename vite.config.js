    import { defineConfig } from 'vite';
    import basicSsl from '@vitejs/plugin-basic-ssl';
    import mkcert from'vite-plugin-mkcert';

    export default defineConfig({
      plugins: [
        // basicSsl(),
        mkcert()
      ],
      // server: {
      //   https: true // Enable HTTPS
      // }
    });