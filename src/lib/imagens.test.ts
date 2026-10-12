import { describe, expect, it } from 'vitest'
import { ehHeic, formatoAceito, tipoArquivo } from './imagens'

describe('tipos de arquivo', () => {
  it('aceita jpeg, png, webp e heic', () => {
    expect(formatoAceito('a.jpg', '')).toBe(true)
    expect(formatoAceito('a.PNG', '')).toBe(true)
    expect(formatoAceito('a.webp', 'image/webp')).toBe(true)
    expect(ehHeic('foto.HEIC', '')).toBe(true)
    expect(formatoAceito('doc.pdf', 'application/pdf')).toBe(false)
  })

  it('deduz o tipo pela extensão', () => {
    expect(tipoArquivo('a.jpeg', '')).toBe('image/jpeg')
  })
})
