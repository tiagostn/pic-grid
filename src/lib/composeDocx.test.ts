import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { projetoVazio } from '../tipos'
import { composeDocx } from './composeDocx'
import { calcularPaginas } from './layout'

const png = new Uint8Array(readFileSync(new URL('../../public/icons/icon-192.png', import.meta.url)))

describe('composeDocx', () => {
  it('gera um docx A4 com a legenda do grupo', async () => {
    const projeto = {
      ...projetoVazio(),
      id: 'docx',
      colunas: 6,
      linhas: 1,
      tamanhoGrupo: 3,
      modoLegenda: 'grupo' as const,
      legendasLigadas: true,
      legendasGrupo: { '0-0-0': 'São Paulo', '0-0-1': 'Outro' },
      slots: ['a', 'b', 'c', 'd', 'e', 'f'],
    }
    const paginas = calcularPaginas(projeto)
    const imagens = new Map<number, Uint8Array>([[0, png], [3, png]])
    const bytes = await composeDocx({ projeto, paginas, imagens })
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK')
    const zip = await JSZip.loadAsync(bytes)
    const xml = await zip.file('word/document.xml')?.async('string')
    expect(xml).toContain('São Paulo')
    expect(xml).toContain('Outro')
    expect(xml).toContain('pgSz')
  })
})
