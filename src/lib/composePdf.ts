import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Alinhamento } from '../tipos'
import { ellipsize, textoSemEmoji, wrapCaption } from './legenda'
import type { PaginaLayout } from './layout'
import { mmParaPt } from './unidades'

export type ImagensPagina = Map<number, Uint8Array>

export async function composePdf(opcoes: {
  paginas: PaginaLayout[]
  imagens: ImagensPagina
  fonteBytes: Uint8Array
  fontePt: number
  alinhamento: Alinhamento
  guiasCorte: boolean
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fontkit = await carregarFontkit()
  doc.registerFontkit(fontkit as Parameters<PDFDocument['registerFontkit']>[0])
  const fonte = await doc.embedFont(opcoes.fonteBytes, { subset: true })

  for (const pagina of opcoes.paginas) {
    const largura = mmParaPt(pagina.larguraMm)
    const altura = mmParaPt(pagina.alturaMm)
    const folha = doc.addPage([largura, altura])

    if (pagina.cabecalho) {
      desenharLinha(
        folha,
        fonte,
        ellipsize(textoSemEmoji(pagina.cabecalho.texto).texto, mmParaPt(pagina.cabecalho.w - 3), (texto) =>
          fonte.widthOfTextAtSize(textoSeguro(fonte, texto), Math.max(opcoes.fontePt, 11)),
        ),
        pagina.cabecalho,
        altura,
        Math.max(opcoes.fontePt, 11),
        'esquerda',
        fonte,
      )
    }

    for (const celula of pagina.celulas) {
      if (opcoes.guiasCorte) {
        folha.drawRectangle({
          x: mmParaPt(celula.celula.x),
          y: altura - mmParaPt(celula.celula.y + celula.celula.h),
          width: mmParaPt(celula.celula.w),
          height: mmParaPt(celula.celula.h),
          borderColor: rgb(0.69, 0.69, 0.69),
          borderWidth: 0.2,
        })
      }

      const bytes = opcoes.imagens.get(celula.slotIndex)
      if (bytes && celula.foto.w > 0 && celula.foto.h > 0) {
        const imagem = await embutir(doc, bytes)
        folha.drawImage(imagem, {
          x: mmParaPt(celula.foto.x),
          y: altura - mmParaPt(celula.foto.y + celula.foto.h),
          width: mmParaPt(celula.foto.w),
          height: mmParaPt(celula.foto.h),
        })
      }

      if (celula.legenda && celula.textoLegenda) {
        const texto = celula.textoLegenda
        const larguraTexto = mmParaPt(Math.max(0, celula.legenda.w - 3))
        const linhas = wrapCaption(texto, larguraTexto, (linha) =>
          fonte.widthOfTextAtSize(textoSeguro(fonte, linha), opcoes.fontePt),
        ).map((linha) => textoSeguro(fonte, linha))
        desenharBloco(folha, fonte, linhas, celula.legenda, altura, opcoes.fontePt, opcoes.alinhamento)
      }
    }
  }

  return doc.save()
}

function desenharLinha(
  folha: PDFPage,
  fonte: PDFFont,
  texto: string,
  caixa: { x: number; y: number; w: number; h: number },
  alturaPagina: number,
  fontePt: number,
  alinhamento: Alinhamento,
  fonteMedida: PDFFont,
) {
  desenharBloco(folha, fonte, texto ? [textoSeguro(fonte, texto)] : [], caixa, alturaPagina, fontePt, alinhamento, fonteMedida)
}

function desenharBloco(
  folha: PDFPage,
  fonte: PDFFont,
  linhas: string[],
  caixa: { x: number; y: number; w: number; h: number },
  alturaPagina: number,
  fontePt: number,
  alinhamento: Alinhamento,
  fonteMedida: PDFFont = fonte,
) {
  if (linhas.length === 0) return
  const alturaLinha = fontePt * 1.25
  const bloco = linhas.length * alturaLinha
  const topo = alturaPagina - mmParaPt(caixa.y)
  const primeiraBase = topo - (mmParaPt(caixa.h) - bloco) / 2 - fontePt * 0.8
  linhas.forEach((linha, indice) => {
    const largura = fonteMedida.widthOfTextAtSize(linha, fontePt)
    const x =
      alinhamento === 'centro' ? mmParaPt(caixa.x + caixa.w / 2) - largura / 2 : mmParaPt(caixa.x + 1.5)
    folha.drawText(linha, {
      x,
      y: primeiraBase - indice * alturaLinha,
      size: fontePt,
      font: fonte,
      color: rgb(0.13, 0.13, 0.13),
    })
  })
}

async function embutir(doc: PDFDocument, bytes: Uint8Array) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return doc.embedPng(bytes)
  return doc.embedJpg(bytes)
}

function textoSeguro(fonte: PDFFont, texto: string): string {
  let saida = ''
  for (const caractere of texto) {
    try {
      fonte.encodeText(caractere)
      saida += caractere
    } catch {
      saida += ''
    }
  }
  return saida
}

async function carregarFontkit(): Promise<{ create: (buffer: Uint8Array) => unknown }> {
  const modulo = (await import('@pdf-lib/fontkit')) as {
    create?: (buffer: Uint8Array) => unknown
    default?: { create: (buffer: Uint8Array) => unknown }
  }
  const create = modulo.create ?? modulo.default?.create
  if (!create) throw new Error('Não foi possível carregar a fonte do PDF')
  return { create }
}
