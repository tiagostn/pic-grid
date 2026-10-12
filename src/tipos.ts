export type Orientacao = 'retrato' | 'paisagem'
export type Alinhamento = 'esquerda' | 'centro'
export type Encaixe = 'cover' | 'contain'
export type FormatoExportacao = 'pdf' | 'png' | 'jpeg' | 'docx'
export type ModoLegenda = 'individual' | 'grupo'
export type Dpi = 150 | 200 | 300
export type Rotacao90 = 0 | 1 | 2 | 3

export type Crop = {
  x: number
  y: number
  largura: number
  altura: number
}

export type Transformacao = {
  crop: Crop
  rotacao90: Rotacao90
  espelhoHorizontal: boolean
}

export type Foto = {
  id: string
  nomeArquivo: string
  legenda: string
  larguraPx: number
  alturaPx: number
  transformacao: Transformacao
}

export type GrupoFolha = {
  id: string
  legenda: string
  colunas: number
  slots: (string | null)[]
}

export type Projeto = {
  id: string
  nome: string
  atualizadoEm: number
  exportadoEm: number | null
  orientacao: Orientacao
  colunas: number
  linhas: number
  margemMm: number
  espacoMm: number
  legendasLigadas: boolean
  modoLegenda: ModoLegenda
  tamanhoGrupo: number
  legendasGrupo: Record<string, string>
  grupos: GrupoFolha[]
  fonteLegendaPt: number
  alinhamentoLegenda: Alinhamento
  dpi: Dpi
  qualidadeJpeg: number
  formatoExportacao: FormatoExportacao
  encaixe: Encaixe
  guiasCorte: boolean
  bordaInternaMm: number
  cabecalho: string
  slots: (string | null)[]
  fotos: Foto[]
}

export const PRESETS: [number, number][] = [
  [1, 1],
  [2, 2],
  [2, 3],
  [3, 3],
  [3, 4],
  [4, 5],
]

export const COTA_BYTES = 200 * 1024 * 1024

export function transformacaoInicial(): Transformacao {
  return {
    crop: { x: 0, y: 0, largura: 1, altura: 1 },
    rotacao90: 0,
    espelhoHorizontal: false,
  }
}

export function projetoVazio(): Projeto {
  return {
    id: crypto.randomUUID(),
    nome: 'Minha folha',
    atualizadoEm: Date.now(),
    exportadoEm: null,
    orientacao: 'retrato',
    colunas: 2,
    linhas: 2,
    margemMm: 10,
    espacoMm: 3,
    legendasLigadas: false,
    modoLegenda: 'individual',
    tamanhoGrupo: 1,
    legendasGrupo: {},
    grupos: [],
    fonteLegendaPt: 9,
    alinhamentoLegenda: 'centro',
    dpi: 200,
    qualidadeJpeg: 0.85,
    formatoExportacao: 'pdf',
    encaixe: 'cover',
    guiasCorte: false,
    bordaInternaMm: 0,
    cabecalho: '',
    slots: [],
    fotos: [],
  }
}

const FORMATOS: FormatoExportacao[] = ['pdf', 'png', 'jpeg', 'docx']

export function normalizarProjeto(bruto: Partial<Projeto> | null | undefined): Projeto {
  const base = projetoVazio()
  if (!bruto) return base
  const colunas = limitarInteiro(bruto.colunas, base.colunas)
  const tamanhoGrupo = limitarInteiro(bruto.tamanhoGrupo, 1)
  const formato = FORMATOS.includes(bruto.formatoExportacao as FormatoExportacao)
    ? (bruto.formatoExportacao as FormatoExportacao)
    : base.formatoExportacao
  return {
    ...base,
    ...bruto,
    id: typeof bruto.id === 'string' && bruto.id ? bruto.id : base.id,
    nome: typeof bruto.nome === 'string' && bruto.nome ? bruto.nome : base.nome,
    orientacao: bruto.orientacao === 'paisagem' ? 'paisagem' : 'retrato',
    colunas,
    linhas: limitarInteiro(bruto.linhas, base.linhas),
    tamanhoGrupo,
    modoLegenda: bruto.modoLegenda === 'grupo' ? 'grupo' : 'individual',
    legendasGrupo: bruto.legendasGrupo && typeof bruto.legendasGrupo === 'object' ? { ...bruto.legendasGrupo } : {},
    grupos: Array.isArray(bruto.grupos) ? bruto.grupos.map((grupo, indice) => normalizarGrupo(grupo, indice, tamanhoGrupo)) : [],
    fotos: Array.isArray(bruto.fotos) ? bruto.fotos : [],
    slots: Array.isArray(bruto.slots) ? bruto.slots : [],
    formatoExportacao: formato,
    encaixe: bruto.encaixe === 'contain' ? 'contain' : 'cover',
    alinhamentoLegenda: bruto.alinhamentoLegenda === 'esquerda' ? 'esquerda' : 'centro',
  }
}

function normalizarGrupo(grupo: Partial<GrupoFolha> | null | undefined, indice: number, colunasPadrao: number): GrupoFolha {
  const slots = Array.isArray(grupo?.slots) ? grupo.slots.map((slot) => (typeof slot === 'string' && slot ? slot : null)) : []
  return {
    id: typeof grupo?.id === 'string' && grupo.id ? grupo.id : `g-${indice}`,
    legenda: typeof grupo?.legenda === 'string' ? grupo.legenda : '',
    colunas: limitarInteiro(grupo?.colunas, colunasPadrao),
    slots: slots.length > 0 ? slots : [null],
  }
}

function limitarInteiro(valor: number | undefined, fallback: number): number {
  const numero = typeof valor === 'number' && Number.isFinite(valor) ? Math.round(valor) : fallback
  return Math.min(10, Math.max(1, numero))
}

export function clonarTransformacao(t: Transformacao): Transformacao {
  return {
    rotacao90: t.rotacao90,
    espelhoHorizontal: t.espelhoHorizontal,
    crop: { ...t.crop },
  }
}
