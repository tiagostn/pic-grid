import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const BASE = '/pic-grid/'

function pacoteOffline(): Plugin {
  let base = BASE
  return {
    name: 'pacote-offline',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        const links = Object.values(ctx.bundle)
          .filter((item) => item.type === 'chunk' && item.fileName.endsWith('.js') && !html.includes(item.fileName))
          .map((item) => `    <link rel="modulepreload" crossorigin href="${base}${item.fileName}">`)
        if (links.length === 0) return html
        return html.replace('</head>', `${links.join('\n')}\n  </head>`)
      },
    },
    closeBundle: {
      order: 'post',
      handler() {
        const dist = join(process.cwd(), 'dist')
        const sw = readFileSync(join(dist, 'sw.js'), 'utf8')
        const faltando: string[] = []
        const andar = (dir: string) => {
          for (const nome of readdirSync(dir)) {
            const caminho = join(dir, nome)
            if (statSync(caminho).isDirectory()) {
              andar(caminho)
              continue
            }
            const arquivo = relative(dist, caminho).split('\\').join('/')
            if (arquivo === 'sw.js' || arquivo.startsWith('workbox-')) continue
            if (!sw.includes(arquivo)) faltando.push(arquivo)
          }
        }
        andar(dist)
        if (faltando.length > 0) throw new Error(`Arquivos fora do cache offline: ${faltando.join(', ')}`)
      },
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'pic-grid',
        short_name: 'pic-grid',
        description: 'Folhas A4 com fotos em grade. As fotos não saem deste computador.',
        lang: 'pt-BR',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*'],
        globIgnores: ['**/*.map', 'sw.js', 'workbox-*.js', '**/node_modules/**/*'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/assets\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
    pacoteOffline(),
  ],
})
