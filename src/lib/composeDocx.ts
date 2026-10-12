import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  type ITableCellBorders,
} from 'docx'
import type { Projeto } from '../tipos'
import { type CelulaLayout, type PaginaLayout } from './layout'

const A4_RETRATO = { largura: 11906, altura: 16838 }

export async function composeDocx(opcoes: {
  projeto: Projeto
  paginas: PaginaLayout[]
  imagens: Map<number, Uint8Array>
}): Promise<Uint8Array> {
  const retrato = opcoes.projeto.orientacao !== 'paisagem'
  const margem = twip(Math.max(0, opcoes.projeto.margemMm))
  const modoGrupo = opcoes.projeto.legendasLigadas && opcoes.projeto.modoLegenda === 'grupo'
  const espaco = Math.max(0, opcoes.projeto.espacoMm)
  const pagina = {
    size: {
      width: retrato ? A4_RETRATO.largura : A4_RETRATO.altura,
      height: retrato ? A4_RETRATO.altura : A4_RETRATO.largura,
      orientation: retrato ? PageOrientation.PORTRAIT : PageOrientation.LANDSCAPE,
    },
    margin: { top: margem, bottom: margem, left: margem, right: margem },
  }

  const doc = new Document({
    sections: opcoes.paginas.map((folha, indice) => ({
      properties: {
        ...(indice > 0 ? { type: SectionType.NEXT_PAGE } : {}),
        page: pagina,
      },
      children: conteudoDaPagina(folha, opcoes, modoGrupo, espaco),
    })),
  })

  const blob = await Packer.toBlob(doc)
  return new Uint8Array(await blob.arrayBuffer())
}

function conteudoDaPagina(
  folha: PaginaLayout,
  opcoes: { projeto: Projeto; imagens: Map<number, Uint8Array> },
  modoGrupo: boolean,
  espaco: number,
): (Paragraph | Table)[] {
  const filhos: (Paragraph | Table)[] = []
  if (folha.cabecalho?.texto) {
    filhos.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: folha.cabecalho.texto, font: 'Arial', size: Math.max(opcoes.projeto.fonteLegendaPt, 11) * 2 })],
      }),
    )
  }

  const linhas = Math.max(1, new Set(folha.celulas.map((celula) => celula.linha)).size)
  for (let linha = 0; linha < linhas; linha += 1) {
    const daLinha = folha.celulas.filter((celula) => celula.linha === linha)
    if (daLinha.length === 0) continue
    const grupos = agrupar(daLinha)
    const celulas: TableCell[] = []
    const larguras: number[] = []
    grupos.forEach((grupo, indiceGrupo) => {
      if (indiceGrupo > 0 && espaco > 0) {
        const larguraEspaco = twip(espaco)
        larguras.push(larguraEspaco)
        celulas.push(celulaVazia(larguraEspaco, 0))
      }
      const larguraGrupo = grupo.reduce((soma, celula) => soma + twip(celula.celula.w), 0)
      larguras.push(larguraGrupo)
      celulas.push(
        new TableCell({
          width: { size: larguraGrupo, type: WidthType.DXA },
          margins: { top: 0, bottom: linha < linhas - 1 ? twip(espaco) : 0, left: 0, right: 0 },
          borders: semBordasTabela(),
          children: conteudoDoGrupo(grupo, opcoes, modoGrupo),
        }),
      )
    })
    filhos.push(
      new Table({
        width: { size: Math.max(1, larguras.reduce((soma, largura) => soma + largura, 0)), type: WidthType.DXA },
        columnWidths: larguras,
        layout: TableLayoutType.FIXED,
        borders: semBordasTabela(),
        rows: [new TableRow({ children: celulas, cantSplit: true })],
      }),
    )
  }
  return filhos
}

function conteudoDoGrupo(
  grupo: CelulaLayout[],
  opcoes: { projeto: Projeto; imagens: Map<number, Uint8Array> },
  modoGrupo: boolean,
): (Paragraph | Table)[] {
  const primeiraLinha = Math.min(...grupo.map((celula) => celula.linhaInterna))
  const larguras = grupo.filter((celula) => celula.linhaInterna === primeiraLinha).map((celula) => twip(celula.celula.w))
  const linhasInternas = [...new Set(grupo.map((celula) => celula.linhaInterna))].sort((a, b) => a - b)
  const tabela = new Table({
    width: { size: larguras.reduce((soma, largura) => soma + largura, 0), type: WidthType.DXA },
    columnWidths: larguras,
    borders: semBordasTabela(),
    rows: linhasInternas.map(
      (linhaInterna) =>
        new TableRow({
          cantSplit: true,
          children: grupo
            .filter((celula) => celula.linhaInterna === linhaInterna)
            .map(
              (celula) =>
                new TableCell({
                  width: { size: twip(celula.celula.w), type: WidthType.DXA },
                  margins: { top: 0, bottom: 0, left: 0, right: 0 },
                  borders: opcoes.projeto.guiasCorte ? bordasGuia() : semBordas(),
                  children: conteudoDaFoto(celula, opcoes.imagens.get(celula.slotIndex), opcoes.projeto, modoGrupo),
                }),
            ),
        }),
    ),
  })
  const filhos: (Paragraph | Table)[] = [tabela]
  if (modoGrupo) {
    const texto = grupo.find((celula) => celula.textoLegenda)?.textoLegenda ?? ''
    if (texto) filhos.push(paragrafoLegenda(texto, opcoes.projeto))
  }
  return filhos
}

function conteudoDaFoto(
  celula: CelulaLayout,
  bytes: Uint8Array | undefined,
  projeto: Projeto,
  modoGrupo: boolean,
): Paragraph[] {
  const filhos: Paragraph[] = []
  if (bytes && celula.foto.w > 0 && celula.foto.h > 0) {
    filhos.push(
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            type: tipoImagem(bytes),
            data: bytes,
            transformation: {
              width: px(celula.foto.w),
              height: px(celula.foto.h),
            },
          }),
        ],
      }),
    )
  } else {
    filhos.push(new Paragraph({}))
  }
  if (!modoGrupo && celula.textoLegenda) filhos.push(paragrafoLegenda(celula.textoLegenda, projeto))
  return filhos
}

function paragrafoLegenda(texto: string, projeto: Projeto): Paragraph {
  return new Paragraph({
    alignment: projeto.alinhamentoLegenda === 'centro' ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: 40, after: 0 },
    children: [new TextRun({ text: texto, font: 'Arial', size: projeto.fonteLegendaPt * 2 })],
  })
}

function celulaVazia(largura: number, margemInferior: number): TableCell {
  return new TableCell({
    width: { size: largura, type: WidthType.DXA },
    margins: { top: 0, bottom: margemInferior, left: 0, right: 0 },
    borders: semBordas(),
    children: [new Paragraph({})],
  })
}

function agrupar(celulas: CelulaLayout[]): CelulaLayout[][] {
  const grupos: CelulaLayout[][] = []
  for (const celula of celulas) {
    const ultimo = grupos[grupos.length - 1]
    if (!ultimo || celula.inicioGrupo) grupos.push([celula])
    else ultimo.push(celula)
  }
  return grupos
}

function semBordas(): ITableCellBorders {
  const borda = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  return { top: borda, bottom: borda, left: borda, right: borda }
}

function semBordasTabela() {
  const borda = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  return { ...semBordas(), insideHorizontal: borda, insideVertical: borda }
}

function bordasGuia(): ITableCellBorders {
  const borda = { style: BorderStyle.SINGLE, size: 4, color: 'B0B0B0' }
  return { top: borda, bottom: borda, left: borda, right: borda }
}

function tipoImagem(bytes: Uint8Array): 'png' | 'jpg' {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png'
  return 'jpg'
}

function twip(mm: number): number {
  return Math.max(0, Math.round((mm / 25.4) * 1440))
}

function px(mm: number): number {
  return Math.max(1, Math.round((mm / 25.4) * 96))
}
