/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.ttf' {
  const src: string
  export default src
}

interface GravadorArquivo {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}

interface AlcaArquivo {
  createWritable(): Promise<GravadorArquivo>
}

interface OpcoesSalvar {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface Window {
  showSaveFilePicker?: (opcoes?: OpcoesSalvar) => Promise<AlcaArquivo>
}
