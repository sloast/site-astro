// @ts-check
import { defineConfig } from 'astro/config';

import alpinejs from '@astrojs/alpinejs';

// https://astro.build/config
export default defineConfig({
    site: 'https://sloast.dev',
    integrations: [
        alpinejs({ entrypoint: '/src/js/entrypoint' }),
    ],
});
