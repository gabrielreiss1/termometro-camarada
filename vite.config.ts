import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Na versão neutra (VITE_MARCA=neutra), troca o nome que aparece na aba e na prévia de links
const marcaNeutra: Plugin = {
  name: 'marca-neutra',
  transformIndexHtml: (html) =>
    process.env.VITE_MARCA === 'neutra'
      ? html.replace('Termômetro Camarada ☭', 'Termômetro do 2º turno').replace('Termômetro Camarada:', 'Termômetro do 2º turno:')
      : html,
};

export default defineConfig({
  plugins: [react(), marcaNeutra],
});
