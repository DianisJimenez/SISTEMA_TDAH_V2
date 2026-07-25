import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000'
    }
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        admi: resolve(__dirname, 'admi.html'),
        agregarPacientes: resolve(__dirname, 'agregarPacientes.html'),
        iniciarSesion: resolve(__dirname, 'iniciarSesion.html'),
        misDispositivos: resolve(__dirname, 'misDispositivos.html'),
        misPruebas: resolve(__dirname, 'misPruebas.html'),
        olvidePassword: resolve(__dirname, 'olvide-password.html'),
        pacientes: resolve(__dirname, 'pacientes.html'),
        perfilMedico: resolve(__dirname, 'perfilMedico.html'),
        perfilPacientes: resolve(__dirname, 'perfilPacientes.html'),
        restablecerPassword: resolve(__dirname, 'restablecer-password.html'),
      }
    }
  }
});
