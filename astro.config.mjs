import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify'; // ✅ nouvelle syntaxe

export default defineConfig({
  output: 'server', // ✅ accepté en Astro 5
  adapter: netlify(), // ✅ nouvelle version de l’adapter
  integrations: [tailwind()]
});