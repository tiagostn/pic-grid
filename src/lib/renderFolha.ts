import type { Alinhamento, Encaixe, Foto } from '../tipos'
import { FAMILIA_FONTE } from './fonte'
import { canvasParaBlob, renderCelula } from './imagens'
import { ellipsize, textoSemEmoji, wrapCaption } from './legenda'
import type { PaginaLayout, Retangulo } from './layout'
import { mmParaPx } from './unidades'

export async function renderPaginaImagem(opcoes: {
  pagina: PaginaLayout
  fotos: Map<string, { blob: Blob; foto: Foto }>
  dpi: number
  qualidade: number
  encaixe: Encaixe
  alinhamento: Alinhamento
  fontePt: number
  guias: boolean
  formato: 'png' | 'jpeg'
}): Promise<Blob> {
  const largura = Math.max(1, mmParaPx(opcoes.pagina.larguraMm, opcoes.dpi))
  const altura = Math.max(1, mmParaPx(opcoes.pagina.alturaMm, opcoes.dpi))
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, largura, altura)
  const pxPorMm = opcoes.dpi / 25.4

  if (opcoes.pagina.cabecalho) {
    const fontePx = (Math.max(opcoes.fontePt, 11) * opcoes.dpi) / 72
    desenharTexto(ctx, [opcoes.pagina.cabecalho.texto], opcoes.pagina.cabecalho, pxPorMm, fontePx, 'esquerda', true)
  }

  for (const celula of opcoes.pagina.celulas) {
    if (opcoes.guias) {
      ctx.strokeStyle = '#b0b0b0'
      ctx.lineWidth = Math.max(1, (0.2 * opcoes.dpi) / 72)
      const x = celula.celula.x * pxPorMm
      const y = celula.celula.y * pxPorMm
      const w = celula.celula.w * pxPorMm
      const h = celula.celula.h * pxPorMm
      ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth)
    }

    const item = celula.fotoId ? opcoes.fotos.get(celula.fotoId) : undefined
    if (item && celula.foto.w > 0 && celula.foto.h > 0) {
      const fotoCanvas = await renderCelula(
        item.blob,
        item.foto.transformacao,
        Math.max(1, mmParaPx(celula.foto.w, opcoes.dpi)),
        Math.max(1, mmParaPx(celula.foto.h, opcoes.dpi)),
        opcoes.encaixe,
      )
      ctx.drawImage(fotoCanvas, celula.foto.x * pxPorMm, celula.foto.y * pxPorMm)
    }

    if (celula.legenda && celula.textoLegenda) {
      const fontePx = (opcoes.fontePt * opcoes.dpi) / 72
      const linhas = linhasDaCaixa(ctx, celula.textoLegenda, celula.legenda, pxPorMm, fontePx)
      desenharTexto(ctx, linhas, celula.legenda, pxPorMm, fontePx, opcoes.alinhamento, false)
    }
  }

  const tipo = opcoes.formato === 'jpeg' ? 'image/jpeg' : 'image/png'
  return canvasParaBlob(canvas, tipo, opcoes.formato === 'jpeg' ? opcoes.qualidade : undefined)
}

function linhasDaCaixa(
  ctx: CanvasRenderingContext2D,
  texto: string,
  caixa: Retangulo,
  pxPorMm: number,
  fontePx: number,
): string[] {
  ctx.font = `${fontePx}px ${FAMILIA_FONTE}, sans-serif`
  const largura = Math.max(0, (caixa.w - 3) * pxPorMm)
  return wrapCaption(texto, largura, (linha) => ctx.measureText(linha).width)
}

function desenharTexto(
  ctx: CanvasRenderingContext2D,
  linhasEntrada: string[],
  caixa: Retangulo,
  pxPorMm: number,
  fontePx: number,
  alinhamento: Alinhamento,
  umaLinha: boolean,
) {
  ctx.font = `${fontePx}px ${FAMILIA_FONTE}, sans-serif`
  ctx.fillStyle = '#222222'
  ctx.textBaseline = 'top'
  const linhas = umaLinha
    ? [
        ellipsize(
          textoSemEmoji(linhasEntrada[0] ?? '').texto,
          Math.max(0, (caixa.w - 3) * pxPorMm),
          (linha) => ctx.measureText(linha).width,
        ),
      ].filter(Boolean)
    : linhasEntrada
  if (linhas.length === 0) return
  const alturaLinha = fontePx * 1.25
  const bloco = linhas.length * alturaLinha
  const topo = caixa.y * pxPorMm + (caixa.h * pxPorMm - bloco) / 2
  ctx.textAlign = alinhamento === 'centro' ? 'center' : 'left'
  linhas.forEach((linha, indice) => {
    const x = alinhamento === 'centro' ? (caixa.x + caixa.w / 2) * pxPorMm : (caixa.x + 1.5) * pxPorMm
    ctx.fillText(linha, x, topo + indice * alturaLinha)
  })
}
