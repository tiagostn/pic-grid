import type { Encaixe, Foto, GrupoFolha, Projeto } from '../tipos'
import { ptParaMm } from './unidades'

export type Retangulo = { x: number; y: number; w: number; h: number }

export type CelulaLayout = {
  slotIndex: number
  fotoId: string | null
  coluna: number
  linha: number
  grupoId: string
  inicioGrupo: boolean
  linhaInterna: number
  celula: Retangulo
  foto: Retangulo
  legenda: Retangulo | null
  textoLegenda: string
}

export type GrupoLayout = {
  id: string
  linha: number
  celulas: CelulaLayout[]
}

export type PaginaLayout = {
  indice: number
  larguraMm: number
  alturaMm: number
  cabecalho: (Retangulo & { texto: string }) | null
  celulas: CelulaLayout[]
  grupos: GrupoLayout[]
  valida: boolean
}

const A4 = {
  retrato: { w: 210, h: 297 },
  paisagem: { w: 297, h: 210 },
} as const

export function apararSlots(slots: (string | null)[]): (string | null)[] {
  const copia = [...slots]
  while (copia.length > 0 && copia[copia.length - 1] == null) copia.pop()
  return copia
}

export function alturaFaixaLegendaMm(fontePt: number): number {
  return ptParaMm(fontePt) * 1.25 * 2 + 1.5
}

export function reservaCabecalhoMm(cabecalho: string, fontePt: number): number {
  if (!cabecalho.trim()) return 0
  return ptParaMm(Math.max(fontePt, 11)) * 1.35 + 2
}

export function tamanhoGrupoEfetivo(tamanhoGrupo: number | undefined): number {
  return limitarInteiro(tamanhoGrupo ?? 1, 1, 10)
}

export function chaveGrupo(pagina: number, linha: number, coluna: number, tamanho: number): string {
  return `${pagina}-${linha}-${Math.floor(coluna / Math.max(1, tamanho))}`
}

export function gruposEfetivos(projeto: Projeto): GrupoFolha[] {
  if (projeto.grupos && projeto.grupos.length > 0) return projeto.grupos
  return sintetizarGrupos(projeto)
}

function sintetizarGrupos(projeto: Projeto): GrupoFolha[] {
  const colunas = limitarInteiro(projeto.colunas, 1, 10)
  const tamanho = tamanhoGrupoEfetivo(projeto.tamanhoGrupo)
  const slots = projeto.slots ?? []
  const grupos: GrupoFolha[] = []
  let atual: GrupoFolha | null = null
  for (let indice = 0; indice < slots.length; indice += 1) {
    const coluna = indice % colunas
    if (!atual || coluna % tamanho === 0) {
      const linha = Math.floor(indice / colunas) % limitarInteiro(projeto.linhas, 1, 10)
      const pagina = Math.floor(indice / (colunas * limitarInteiro(projeto.linhas, 1, 10)))
      atual = {
        id: `g-${indice}`,
        legenda: projeto.legendasGrupo?.[chaveGrupo(pagina, linha, coluna, tamanho)] ?? '',
        slots: [],
        colunas: tamanho,
      }
      grupos.push(atual)
    }
    atual.slots.push(slots[indice] ?? null)
  }
  return grupos
}

export function calcularPaginas(projeto: Projeto): PaginaLayout[] {
  const pagina = A4[projeto.orientacao]
  const colunas = limitarInteiro(projeto.colunas, 1, 10)
  const linhas = limitarInteiro(projeto.linhas, 1, 10)
  const modoGrupo = projeto.legendasLigadas && projeto.modoLegenda === 'grupo'
  const margem = Math.max(0, projeto.margemMm)
  const espaco = Math.max(0, projeto.espacoMm)
  const reservaCabecalho = reservaCabecalhoMm(projeto.cabecalho, projeto.fonteLegendaPt)
  const faixa = projeto.legendasLigadas ? alturaFaixaLegendaMm(projeto.fonteLegendaPt) : 0
  const larguraInterna = pagina.w - margem * 2
  const alturaInterna = pagina.h - margem * 2 - reservaCabecalho
  const alturaCelula = (alturaInterna - espaco * (linhas - 1)) / linhas
  const alturaFoto = alturaCelula - faixa
  const textoCabecalho = ptParaMm(Math.max(projeto.fonteLegendaPt, 11)) * 1.35
  const referencia = tamanhoGrupoEfetivo(projeto.tamanhoGrupo)
  const gruposCheios = Math.max(1, Math.floor(colunas / referencia))
  const larguraCelula = (larguraInterna - espaco * Math.max(0, gruposCheios - 1)) / Math.max(1, gruposCheios * referencia)
  const grupos = gruposEfetivos(projeto)
  const paginas: PaginaLayout[] = []
  let paginaAtual = novaPagina(0, pagina, reservaCabecalho, margem, larguraInterna, textoCabecalho, projeto.cabecalho)
  let x = margem
  let y = margem + reservaCabecalho
  let usados = 0
  let baseFaixa = y
  let fundoFaixa = y
  let banda = 0
  const fecharFaixa = () => {
    if (usados === 0) return
    y = fundoFaixa + espaco
    x = margem
    usados = 0
    baseFaixa = y
    fundoFaixa = y
    banda += 1
  }

  if (grupos.length === 0) {
    const larguraVazia = (larguraInterna - espaco * (colunas - 1)) / colunas
    for (let linha = 0; linha < linhas; linha += 1) {
      const yLinha = margem + reservaCabecalho + linha * (alturaCelula + espaco)
      for (let coluna = 0; coluna < colunas; coluna += 1) {
        const xCelula = margem + coluna * (larguraVazia + espaco)
        paginaAtual.celulas.push(
          criarCelula({
            slotIndex: -(linha * colunas + coluna + 1),
            fotoId: null,
            coluna,
            linha,
            linhaInterna: 0,
            grupoId: '',
            inicioGrupo: true,
            x: xCelula,
            y: yLinha,
            larguraCelula: larguraVazia,
            alturaCelula,
            alturaFoto,
            faixa,
            insetMm: projeto.bordaInternaMm,
            legenda: projeto.legendasLigadas ? { x: xCelula, y: yLinha + alturaFoto, w: larguraVazia, h: faixa } : null,
            textoLegenda: '',
          }),
        )
      }
    }
    paginaAtual.valida = larguraVazia >= 2 && alturaCelula >= 2 && alturaFoto >= 2
    return [paginaAtual]
  }

  let cursor = 0
  for (const grupo of grupos) {
    const cols = Math.min(colunas, Math.max(1, grupo.colunas || referencia))
    const fotosNoGrupo = Math.max(grupo.slots.length, 1)
    const linhasInternas = Math.max(1, Math.ceil(fotosNoGrupo / cols))
    const passo = modoGrupo || !projeto.legendasLigadas ? alturaFoto : alturaFoto + faixa
    const alturaBloco = modoGrupo ? linhasInternas * alturaFoto + (projeto.legendasLigadas ? faixa : 0) : linhasInternas * passo
    if (usados > 0 && usados + cols > colunas) fecharFaixa()
    if (baseFaixa > margem + reservaCabecalho && baseFaixa + alturaBloco > pagina.h - margem) {
      paginas.push(paginaAtual)
      paginaAtual = novaPagina(paginas.length, pagina, reservaCabecalho, margem, larguraInterna, textoCabecalho, projeto.cabecalho)
      x = margem
      y = margem + reservaCabecalho
      usados = 0
      baseFaixa = y
      fundoFaixa = y
      banda = 0
    }
    const celulasDoGrupo: CelulaLayout[] = []
    for (let i = 0; i < grupo.slots.length; i += 1) {
      const colunaInterna = i % cols
      const linhaInterna = Math.floor(i / cols)
      const fotoId = grupo.slots[i] ?? null
      const xCelula = x + colunaInterna * larguraCelula
      const yCelula = baseFaixa + linhaInterna * passo
      const texto = modoGrupo
        ? i === 0
          ? grupo.legenda
          : ''
        : fotoDoSlot(projeto, fotoId)?.legenda ?? ''
      const celula = criarCelula({
        slotIndex: cursor + i,
        fotoId,
        coluna: colunaInterna,
        linha: banda,
        linhaInterna,
        grupoId: grupo.id,
        inicioGrupo: i === 0,
        x: xCelula,
        y: yCelula,
        larguraCelula,
        alturaCelula: passo,
        alturaFoto,
        faixa,
        insetMm: projeto.bordaInternaMm,
        legenda:
          projeto.legendasLigadas && (modoGrupo ? i === 0 : true)
            ? {
                x: modoGrupo ? x : xCelula,
                y: modoGrupo ? baseFaixa + linhasInternas * alturaFoto : yCelula + alturaFoto,
                w: modoGrupo ? cols * larguraCelula : larguraCelula,
                h: faixa,
              }
            : null,
        textoLegenda: projeto.legendasLigadas ? texto : '',
      })
      paginaAtual.celulas.push(celula)
      celulasDoGrupo.push(celula)
    }
    paginaAtual.grupos.push({ id: grupo.id, linha: 0, celulas: celulasDoGrupo })
    cursor += grupo.slots.length
    x += cols * larguraCelula + espaco
    usados += cols
    fundoFaixa = Math.max(fundoFaixa, baseFaixa + alturaBloco)
  }
  paginas.push(paginaAtual)
  const larguraMinima = larguraCelula
  for (const folha of paginas) {
    folha.valida = larguraMinima >= 2 && alturaCelula >= 2 && alturaFoto >= 2 && larguraInterna > 0 && alturaInterna > 0
  }
  return paginas
}

function novaPagina(
  indice: number,
  medida: { w: number; h: number },
  reservaCabecalho: number,
  margem: number,
  larguraInterna: number,
  textoCabecalho: number,
  cabecalho: string,
): PaginaLayout {
  return {
    indice,
    larguraMm: medida.w,
    alturaMm: medida.h,
    cabecalho: reservaCabecalho
      ? { x: margem, y: margem, w: larguraInterna, h: textoCabecalho, texto: cabecalho.trim() }
      : null,
    celulas: [],
    grupos: [],
    valida: true,
  }
}

function criarCelula(dados: {
  slotIndex: number
  fotoId: string | null
  coluna: number
  linha: number
  grupoId: string
  inicioGrupo: boolean
  linhaInterna: number
  x: number
  y: number
  larguraCelula: number
  alturaCelula: number
  alturaFoto: number
  faixa: number
  insetMm: number
  legenda: Retangulo | null
  textoLegenda: string
}): CelulaLayout {
  const inset = Math.min(Math.max(0, dados.insetMm), dados.larguraCelula / 4, dados.alturaFoto / 4)
  return {
    slotIndex: dados.slotIndex,
    fotoId: dados.fotoId,
    coluna: dados.coluna,
    linha: dados.linha,
    grupoId: dados.grupoId,
    inicioGrupo: dados.inicioGrupo,
    linhaInterna: dados.linhaInterna,
    celula: { x: dados.x, y: dados.y, w: dados.larguraCelula, h: dados.alturaCelula },
    foto: {
      x: dados.x + inset,
      y: dados.y + inset,
      w: Math.max(0, dados.larguraCelula - inset * 2),
      h: Math.max(0, dados.alturaFoto - inset * 2),
    },
    legenda: dados.legenda,
    textoLegenda: dados.textoLegenda,
  }
}

export function fotoDoSlot(projeto: Projeto, id: string | null): Foto | null {
  if (!id) return null
  return projeto.fotos.find((foto) => foto.id === id) ?? null
}

export function dpiEfetivo(
  foto: Foto,
  larguraMm: number,
  alturaMm: number,
  encaixe: Encaixe,
  dpiAlvo: number,
): number {
  const troca = foto.transformacao.rotacao90 % 2 === 1
  const baseLargura = troca ? foto.alturaPx : foto.larguraPx
  const baseAltura = troca ? foto.larguraPx : foto.alturaPx
  const recorteLargura = baseLargura * foto.transformacao.crop.largura
  const recorteAltura = baseAltura * foto.transformacao.crop.altura
  const saidaLargura = (larguraMm / 25.4) * dpiAlvo
  const saidaAltura = (alturaMm / 25.4) * dpiAlvo
  if (recorteLargura < 1 || recorteAltura < 1 || saidaLargura < 1 || saidaAltura < 1) return dpiAlvo
  const escala =
    encaixe === 'cover'
      ? Math.max(saidaLargura / recorteLargura, saidaAltura / recorteAltura)
      : Math.min(saidaLargura / recorteLargura, saidaAltura / recorteAltura)
  return dpiAlvo / escala
}

function limitarInteiro(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(valor)))
}
