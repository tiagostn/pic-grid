import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { projetoVazio } from '../tipos'
import { composePdf } from './composePdf'
import { calcularPaginas } from './layout'
import { mmParaPt } from './unidades'

const fonte = new Uint8Array(readFileSync(new URL('../assets/fonts/Inter-Regular.ttf', import.meta.url)))
const png = new Uint8Array(readFileSync(new URL('../../public/icons/icon-192.png', import.meta.url)))

describe('composePdf', () => {
  it('gera A4 retrato com acento e duas páginas', async () => {
    const projeto = {
      ...projetoVazio(),
      id: 'pdf',
      orientacao: 'retrato' as const,
      colunas: 1,
      linhas: 1,
      legendasLigadas: true,
      slots: ['a', 'b'],
      fotos: [
        {
          id: 'a',
          nomeArquivo: 'a.jpg',
          legenda: 'São Paulo, ação e coração',
          larguraPx: 10,
          alturaPx: 10,
          transformacao: { crop: { x: 0, y: 0, largura: 1, altura: 1 }, rotacao90: 0 as const, espelhoHorizontal: false },
        },
        {
          id: 'b',
          nomeArquivo: 'b.jpg',
          legenda: 'Segunda',
          larguraPx: 10,
          alturaPx: 10,
          transformacao: { crop: { x: 0, y: 0, largura: 1, altura: 1 }, rotacao90: 0 as const, espelhoHorizontal: false },
        },
      ],
    }
    const paginas = calcularPaginas(projeto)
    const imagens = new Map<number, Uint8Array>([
      [0, png],
      [1, png],
    ])
    const bytes = await composePdf({
      paginas,
      imagens,
      fonteBytes: fonte,
      fontePt: 9,
      alinhamento: 'centro',
      guiasCorte: true,
    })
    const doc = await PDFDocument.load(bytes)
    expect(bytes[0]).toBe('%'.charCodeAt(0))
    expect(doc.getPageCount()).toBe(2)
    const tamanho = doc.getPage(0).getSize()
    expect(tamanho.width).toBeCloseTo(mmParaPt(210), 1)
    expect(tamanho.height).toBeCloseTo(mmParaPt(297), 1)
    expect(doc.getPage(1).getSize().width).toBeCloseTo(mmParaPt(210), 1)
  })
})
