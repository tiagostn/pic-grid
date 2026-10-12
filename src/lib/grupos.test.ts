import { describe, expect, it } from 'vitest'
import { adicionarFotosNosGrupos, anexarFotoAoGrupo, definirColunasDoGrupo, excluirFotoDoGrupo, incluirFotosNoGrupo, moverFoto, moverGrupo } from './grupos'
import type { GrupoFolha } from '../tipos'

function grupos(): GrupoFolha[] {
  return [
    { id: 'g1', legenda: 'Um', colunas: 3, slots: ['a', 'b', 'c'] },
    { id: 'g2', legenda: 'Dois', colunas: 3, slots: ['d', null, 'f'] },
  ]
}

describe('grupos', () => {
  it('mover uma foto para um espaço vazio deixa o lugar de origem vazio', () => {
    const resultado = moverFoto(grupos(), 0, 4)
    expect(resultado[0]?.slots).toEqual([null, 'b', 'c'])
    expect(resultado[1]?.slots).toEqual(['d', 'a', 'f'])
  })

  it('trocar duas fotos não altera o tamanho do grupo', () => {
    const resultado = moverFoto(grupos(), 0, 2)
    expect(resultado[0]?.slots).toEqual(['c', 'b', 'a'])
    expect(resultado[1]?.slots).toEqual(['d', null, 'f'])
  })

  it('excluir do grupo conserva o espaço vazio', () => {
    const resultado = excluirFotoDoGrupo(grupos(), 'b')
    expect(resultado[0]?.slots).toEqual(['a', null, 'c'])
  })

  it('reordena o grupo inteiro', () => {
    const resultado = moverGrupo(grupos(), 'g2', 'g1')
    expect(resultado.map((grupo) => grupo.id)).toEqual(['g2', 'g1'])
  })

  it('mudar as colunas não tira fotos do grupo', () => {
    const resultado = definirColunasDoGrupo(grupos(), 'g1', 2)
    expect(resultado[0]?.colunas).toBe(2)
    expect(resultado[0]?.slots).toEqual(['a', 'b', 'c'])
    expect(resultado).toHaveLength(2)
  })

  it('arrastar para outro grupo inclui a foto e deixa o lugar vazio', () => {
    const resultado = moverFoto(grupos(), 0, 3)
    expect(resultado[0]?.slots).toEqual([null, 'b', 'c'])
    expect(resultado[1]?.slots).toEqual(['a', 'd', null, 'f'])
  })

  it('soltar no grupo acrescenta a foto no fim', () => {
    const resultado = anexarFotoAoGrupo(grupos(), 0, 'g2')
    expect(resultado[0]?.slots).toEqual([null, 'b', 'c'])
    expect(resultado[1]?.slots).toEqual(['d', null, 'f', 'a'])
  })

  it('fotos novas entram num grupo existente', () => {
    const resultado = incluirFotosNoGrupo(grupos(), 'g1', ['x', 'y'])
    expect(resultado[0]?.slots).toEqual(['a', 'b', 'c', 'x', 'y'])
    expect(resultado).toHaveLength(2)
  })

  it('fotos novas entram em grupos do tamanho pedido, sem preencher buracos', () => {
    const resultado = adicionarFotosNosGrupos(grupos(), ['x', 'y'], 2)
    expect(resultado.slice(2).map((grupo) => grupo.slots)).toEqual([['x', 'y']])
    expect(resultado[1]?.slots).toEqual(['d', null, 'f'])
  })
})
