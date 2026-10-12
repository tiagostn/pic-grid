import { describe, expect, it } from 'vitest'
import { ellipsize, temEmoji, textoSemEmoji, wrapCaption } from './legenda'

const medir = (s: string) => s.length * 10

describe('legenda', () => {
  it('remove emoji e preserva acentos', () => {
    const resultado = textoSemEmoji('São 😀 Paulo')
    expect(resultado.removeu).toBe(true)
    expect(resultado.texto).toBe('São  Paulo')
    expect(temEmoji('ação')).toBe(false)
  })

  it('corta palavra longa', () => {
    expect(ellipsize('abcdefghij', 50, medir)).toBe('abcd…')
  })

  it('mantém uma linha curta', () => {
    expect(wrapCaption('Olá', 100, medir)).toEqual(['Olá'])
  })

  it('quebra em duas linhas e reticências na segunda', () => {
    const linhas = wrapCaption('um dois tres quatro cinco', 70, medir)
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toBe('um dois')
    expect(linhas[1]?.endsWith('…')).toBe(true)
  })

  it('texto vazio não gera linha', () => {
    expect(wrapCaption('   ', 100, medir)).toEqual([])
  })
})
