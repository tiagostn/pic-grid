import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { registerSW } from 'virtual:pwa-register'
import '@mantine/core/styles.css'
import '@mantine/dropzone/styles.css'
import 'react-easy-crop/react-easy-crop.css'
import App from './App'
import './global.css'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider forceColorScheme="light">
      <App />
    </MantineProvider>
  </StrictMode>,
)
