import { describe, expect, it } from 'vitest'
import { projetoVazio, type Projeto } from '../tipos'
import { alturaFaixaLegendaMm, apararSlots, calcularPaginas, dpiEfetivo } from './layout'
import { mmParaPx } from './unidades'

function grade(parcial: Partial<Projeto> = {}): Projeto {
  return { ...projetoVazio(), ...parcial, id: 'teste' }
}

describe('layout A4', () => {
  it('retrato e paisagem trocam os lados', () => {
    const retrato = calcularPaginas(grade({ orientacao: 'retrato' }))[0]
    const paisagem = calcularPaginas(grade({ orientacao: 'paisagem' }))[0]
    expect(retrato?.larguraMm).toBe(210)
    expect(retrato?.alturaMm).toBe(297)
    expect(paisagem?.larguraMm).toBe(297)
    expect(paisagem?.alturaMm).toBe(210)
  })

  it('2×2 com margem 10 e espaço 3 preenche a área interna', () => {
    const pagina = calcularPaginas(grade({ colunas: 2, linhas: 2, margemMm: 10, espacoMm: 3 }))[0]
    expect(pagina?.celulas).toHaveLength(4)
    const [a, b] = pagina?.celulas ?? []
    expect(a && b).toBeTruthy()
    if (!a || !b) return
    expect(a.celula.x).toBeCloseTo(10)
    expect(b.celula.x).toBeCloseTo(10 + a.celula.w + 3)
    expect(a.celula.w + b.celula.w + 3).toBeCloseTo(190)
    expect(a.legenda).toBeNull()
    expect(a.foto.h).toBeCloseTo(a.celula.h)
  })

  it('legenda reserva faixa e encolhe a foto', () => {
    const pagina = calcularPaginas(grade({ legendasLigadas: true, fonteLegendaPt: 9 }))[0]
    const celula = pagina?.celulas[0]
    expect(celula?.legenda?.h).toBeCloseTo(alturaFaixaLegendaMm(9))
    expect(celula && celula.foto.h + (celula.legenda?.h ?? 0)).toBeCloseTo(celula.celula.h)
  })

  it('cabeçalho empurra a grade para baixo', () => {
    const sem = calcularPaginas(grade())[0]
    const com = calcularPaginas(grade({ cabecalho: 'Festa' }))[0]
    expect(com?.cabecalho?.texto).toBe('Festa')
    expect(com && sem && com.celulas[0].celula.y).toBeGreaterThan(sem.celulas[0].celula.y)
  })

  it('fotos além da grade abrem outra página e buraco no meio permanece', () => {
    const paginas = calcularPaginas(
      grade({
        colunas: 2,
        linhas: 2,
        slots: ['a', null, 'b', 'c', 'd'],
      }),
    )
    expect(paginas).toHaveLength(2)
    expect(paginas[0]?.celulas.map((c) => c.fotoId)).toEqual(['a', null, 'b', 'c'])
    expect(paginas[1]?.celulas[0]?.fotoId).toBe('d')
  })

  it('null no fim não cria página extra', () => {
    const paginas = calcularPaginas(grade({ colunas: 2, linhas: 2, slots: ['a', null, null] }))
    expect(paginas).toHaveLength(1)
    expect(apararSlots(['a', null, null])).toEqual(['a'])
  })

  it('folha em branco continua com uma página', () => {
    expect(calcularPaginas(grade({ slots: [] }))).toHaveLength(1)
  })

  it('pixels da A4 a 200 dpi', () => {
    expect(mmParaPx(210, 200)).toBe(1654)
    expect(mmParaPx(297, 200)).toBe(2339)
  })

  it('avisa dpi quando a foto é menor que a célula', () => {
    const projeto = grade({ dpi: 200, encaixe: 'cover' })
    const foto = projeto.fotos[0]
    const pequena = {
      id: 'p',
      nomeArquivo: 'p.jpg',
      legenda: '',
      larguraPx: 100,
      alturaPx: 100,
      transformacao: {
        crop: { x: 0, y: 0, largura: 1, altura: 1 },
        rotacao90: 0 as const,
        espelhoHorizontal: false,
      },
    }
    expect(dpiEfetivo(pequena, 90, 90, 'cover', 200)).toBeLessThan(200)
    expect(foto).toBeUndefined()
  })

  it('margem grande demais invalida a folha', () => {
    const pagina = calcularPaginas(grade({ margemMm: 120 }))[0]
    expect(pagina?.valida).toBe(false)
  })

  it('grupo de três encosta as fotos e separa os grupos', () => {
    const pagina = calcularPaginas(
      grade({
        colunas: 6,
        linhas: 1,
        margemMm: 10,
        espacoMm: 3,
        tamanhoGrupo: 3,
        slots: ['a', 'b', 'c', 'd', 'e', 'f'],
      }),
    )[0]
    const celulas = pagina?.celulas ?? []
    expect(celulas).toHaveLength(6)
    const direita = (indice: number) => (celulas[indice]?.celula.x ?? 0) + (celulas[indice]?.celula.w ?? 0)
    expect(celulas[1]?.celula.x).toBeCloseTo(direita(0))
    expect(celulas[2]?.celula.x).toBeCloseTo(direita(1))
    expect(celulas[3]?.celula.x).toBeCloseTo(direita(2) + 3)
    expect(celulas[4]?.celula.x).toBeCloseTo(direita(3))
    expect(direita(5)).toBeCloseTo(200)
  })

  it('legenda do grupo cobre as três fotos e as outras ficam sem faixa', () => {
    const pagina = calcularPaginas(
      grade({
        colunas: 6,
        linhas: 1,
        tamanhoGrupo: 3,
        modoLegenda: 'grupo',
        legendasLigadas: true,
        legendasGrupo: { '0-0-0': 'Primeiro', '0-0-1': 'Segundo' },
        slots: ['a', 'b', 'c', 'd', 'e', 'f'],
      }),
    )[0]
    const celulas = pagina?.celulas ?? []
    expect(celulas[0]?.textoLegenda).toBe('Primeiro')
    expect(celulas[0]?.legenda?.w).toBeCloseTo((celulas[0]?.celula.w ?? 0) * 3)
    expect(celulas[1]?.legenda).toBeNull()
    expect(celulas[2]?.legenda).toBeNull()
    expect(celulas[3]?.textoLegenda).toBe('Segundo')
    expect(celulas[3]?.legenda?.x).toBeCloseTo(celulas[3]?.celula.x ?? 0)
  })

  it('legenda individual continua em cada foto mesmo dentro do grupo', () => {
    const pagina = calcularPaginas(
      grade({
        colunas: 3,
        linhas: 1,
        tamanhoGrupo: 3,
        modoLegenda: 'individual',
        legendasLigadas: true,
        fotos: [
          {
            id: 'a',
            nomeArquivo: 'a.jpg',
            legenda: 'Um',
            larguraPx: 100,
            alturaPx: 100,
            transformacao: {
              crop: { x: 0, y: 0, largura: 1, altura: 1 },
              rotacao90: 0,
              espelhoHorizontal: false,
            },
          },
        ],
        slots: ['a', 'b', 'c'],
      }),
    )[0]
    expect(pagina?.celulas[0]?.textoLegenda).toBe('Um')
    expect(pagina?.celulas[0]?.legenda?.w).toBeCloseTo(pagina?.celulas[0]?.celula.w ?? 0)
    expect(pagina?.celulas[1]?.legenda).not.toBeNull()
    expect(pagina?.celulas[2]?.textoLegenda).toBe('')
  })

  it('um buraco no meio do grupo continua ocupando lugar', () => {
    const pagina = calcularPaginas(
      grade({
        colunas: 6,
        linhas: 1,
        margemMm: 10,
        espacoMm: 4,
        modoLegenda: 'grupo',
        legendasLigadas: true,
        grupos: [
          { id: 'g1', legenda: 'Primeiro', colunas: 3, slots: ['a', null, 'c'] },
          { id: 'g2', legenda: 'Segundo', colunas: 1, slots: ['d'] },
        ],
      }),
    )[0]
    const celulas = pagina?.celulas ?? []
    expect(celulas.map((celula) => celula.fotoId)).toEqual(['a', null, 'c', 'd'])
    const direita = (indice: number) => (celulas[indice]?.celula.x ?? 0) + (celulas[indice]?.celula.w ?? 0)
    expect(celulas[1]?.celula.x).toBeCloseTo(direita(0))
    expect(celulas[2]?.celula.x).toBeCloseTo(direita(1))
    expect(celulas[3]?.celula.x).toBeCloseTo(direita(2) + 4)
    expect(celulas[0]?.legenda?.w).toBeCloseTo((celulas[0]?.celula.w ?? 0) * 3)
    expect(celulas[1]?.legenda).toBeNull()
  })

  it('cinco fotos em grupo de 3 descem sem espaço e o grupo ao lado não estica', () => {
    const pagina = calcularPaginas(
      grade({
        colunas: 6,
        linhas: 2,
        margemMm: 10,
        espacoMm: 3,
        tamanhoGrupo: 3,
        grupos: [
          { id: 'g1', legenda: '', colunas: 3, slots: ['a', 'b', 'c', 'd', 'e'] },
          { id: 'g2', legenda: '', colunas: 3, slots: ['f', 'g', 'h'] },
        ],
      }),
    )[0]
    const celulas = pagina?.celulas ?? []
    const doGrupo = (id: string) => celulas.filter((celula) => celula.grupoId === id)
    const g1 = doGrupo('g1')
    const g2 = doGrupo('g2')
    expect(g1[3]?.celula.y).toBeCloseTo((g1[0]?.celula.y ?? 0) + (g1[0]?.celula.h ?? 0))
    expect(g2[0]?.celula.x).toBeCloseTo((g1[2]?.celula.x ?? 0) + (g1[2]?.celula.w ?? 0) + 3)
    expect(g2[0]?.celula.w).toBeCloseTo(g1[0]?.celula.w ?? 0)
    const sozinho = calcularPaginas(
      grade({
        colunas: 6,
        linhas: 2,
        margemMm: 10,
        espacoMm: 3,
        tamanhoGrupo: 3,
        grupos: [{ id: 'g3', legenda: '', colunas: 3, slots: ['i', 'j'] }],
      }),
    )[0]
    const ultimo = sozinho?.celulas.filter((celula) => celula.fotoId) ?? []
    expect(ultimo[0]?.celula.w).toBeCloseTo(g1[0]?.celula.w ?? 0)
    expect((ultimo[1]?.celula.x ?? 0) + (ultimo[1]?.celula.w ?? 0)).toBeLessThan(190)
  })
})
