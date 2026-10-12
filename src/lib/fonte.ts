import fonteUrl from '../assets/fonts/Inter-Regular.ttf'

let bytes: ArrayBuffer | null = null
let pendente: Promise<ArrayBuffer> | null = null

export const FAMILIA_FONTE = 'PicGridInter'

export function carregarFonte(): Promise<ArrayBuffer> {
  if (bytes) return Promise.resolve(bytes)
  if (!pendente) {
    pendente = fetch(fonteUrl)
      .then((resposta) => {
        if (!resposta.ok) throw new Error('Fonte indisponível')
        return resposta.arrayBuffer()
      })
      .then(async (buffer) => {
        const face = new FontFace(FAMILIA_FONTE, buffer)
        await face.load()
        document.fonts.add(face)
        bytes = buffer
        return buffer
      })
  }
  return pendente
}
