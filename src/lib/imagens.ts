import type { Encaixe, Rotacao90, Transformacao } from '../tipos'

const BORDA_MAX = 3600

export function ehHeic(nome: string, tipo: string): boolean {
  return tipo === 'image/heic' || tipo === 'image/heif' || /\.heic$/i.test(nome) || /\.heif$/i.test(nome)
}

export function tipoArquivo(nome: string, tipo: string): string {
  if (tipo) return tipo
  const extensao = nome.split('.').pop()?.toLowerCase()
  if (extensao === 'jpg' || extensao === 'jpeg') return 'image/jpeg'
  if (extensao === 'png') return 'image/png'
  if (extensao === 'webp') return 'image/webp'
  if (extensao === 'heic') return 'image/heic'
  if (extensao === 'heif') return 'image/heif'
  return ''
}

export function formatoAceito(nome: string, tipo: string): boolean {
  const resolvido = tipoArquivo(nome, tipo)
  return ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(resolvido)
}

const cacheBitmap = new WeakMap<Blob, Promise<ImageBitmap>>()

export function bitmapOrientado(blob: Blob): Promise<ImageBitmap> {
  const existente = cacheBitmap.get(blob)
  if (existente) return existente
  const pendente = decodificar(blob).catch((erro: unknown) => {
    cacheBitmap.delete(blob)
    throw erro
  })
  cacheBitmap.set(blob, pendente)
  return pendente
}

async function decodificar(blob: Blob): Promise<ImageBitmap> {
  const opcoes = { imageOrientation: 'from-image' } as ImageBitmapOptions
  const sonda = await createImageBitmap(blob, opcoes)
  const maior = Math.max(sonda.width, sonda.height)
  if (maior <= BORDA_MAX) return sonda
  const escala = BORDA_MAX / maior
  const resizeWidth = Math.max(1, Math.round(sonda.width * escala))
  const resizeHeight = Math.max(1, Math.round(sonda.height * escala))
  sonda.close()
  return createImageBitmap(blob, { ...opcoes, resizeWidth, resizeHeight, resizeQuality: 'high' })
}

export function rasterizar(bitmap: ImageBitmap, rotacao: Rotacao90, espelho: boolean): HTMLCanvasElement {
  const troca = rotacao % 2 === 1
  const largura = troca ? bitmap.height : bitmap.width
  const altura = troca ? bitmap.width : bitmap.height
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  ctx.save()
  if (rotacao === 1) {
    ctx.translate(largura, 0)
    ctx.rotate(Math.PI / 2)
  } else if (rotacao === 2) {
    ctx.translate(largura, altura)
    ctx.rotate(Math.PI)
  } else if (rotacao === 3) {
    ctx.translate(0, altura)
    ctx.rotate(-Math.PI / 2)
  }
  ctx.drawImage(bitmap, 0, 0)
  ctx.restore()
  if (!espelho) return canvas

  const espelhado = document.createElement('canvas')
  espelhado.width = largura
  espelhado.height = altura
  const contexto = espelhado.getContext('2d')
  if (!contexto) throw new Error('Canvas indisponível')
  contexto.translate(largura, 0)
  contexto.scale(-1, 1)
  contexto.drawImage(canvas, 0, 0)
  return espelhado
}

export async function renderCelula(
  blob: Blob,
  transformacao: Transformacao,
  largura: number,
  altura: number,
  encaixe: Encaixe,
): Promise<HTMLCanvasElement> {
  const bitmap = await bitmapOrientado(blob)
  const origem = rasterizar(bitmap, transformacao.rotacao90, transformacao.espelhoHorizontal)
  const destino = document.createElement('canvas')
  destino.width = Math.max(1, largura)
  destino.height = Math.max(1, altura)
  const ctx = destino.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, destino.width, destino.height)

  const sx = transformacao.crop.x * origem.width
  const sy = transformacao.crop.y * origem.height
  const sw = Math.max(1, transformacao.crop.largura * origem.width)
  const sh = Math.max(1, transformacao.crop.altura * origem.height)
  const caixa = encaixar(sw, sh, destino.width, destino.height, encaixe)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, destino.width, destino.height)
  ctx.clip()
  ctx.drawImage(origem, sx, sy, sw, sh, caixa.x, caixa.y, caixa.w, caixa.h)
  ctx.restore()
  return destino
}

export async function midiaDoEditor(
  blob: Blob,
  rotacao: Rotacao90,
  espelho: boolean,
): Promise<{ url: string; largura: number; altura: number }> {
  const bitmap = await bitmapOrientado(blob)
  const cheio = rasterizar(bitmap, rotacao, espelho)
  const maior = Math.max(cheio.width, cheio.height)
  const limite = 1800
  const canvas = maior <= limite ? cheio : document.createElement('canvas')
  if (canvas !== cheio) {
    const escala = limite / maior
    canvas.width = Math.max(1, Math.round(cheio.width * escala))
    canvas.height = Math.max(1, Math.round(cheio.height * escala))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas indisponível')
    ctx.drawImage(cheio, 0, 0, canvas.width, canvas.height)
  }
  const arquivo = await canvasParaBlob(canvas, 'image/jpeg', 0.92)
  return { url: URL.createObjectURL(arquivo), largura: canvas.width, altura: canvas.height }
}

export function canvasParaJpeg(canvas: HTMLCanvasElement, qualidade: number): Promise<Uint8Array> {
  return canvasParaBlob(canvas, 'image/jpeg', qualidade).then(async (blob) => new Uint8Array(await blob.arrayBuffer()))
}

export function canvasParaBlob(canvas: HTMLCanvasElement, tipo: string, qualidade?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Não foi possível gerar a imagem'))
          return
        }
        resolve(blob)
      },
      tipo,
      qualidade,
    )
  })
}

function encaixar(larguraOrigem: number, alturaOrigem: number, larguraDestino: number, alturaDestino: number, encaixe: Encaixe) {
  const escala =
    encaixe === 'cover'
      ? Math.max(larguraDestino / larguraOrigem, alturaDestino / alturaOrigem)
      : Math.min(larguraDestino / larguraOrigem, alturaDestino / alturaOrigem)
  const w = larguraOrigem * escala
  const h = alturaOrigem * escala
  return { x: (larguraDestino - w) / 2, y: (alturaDestino - h) / 2, w, h }
}
