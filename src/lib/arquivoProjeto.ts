import JSZip from 'jszip'
import { normalizarProjeto, type Projeto } from '../tipos'

export async function empacotarProjeto(projeto: Projeto, blobs: Map<string, Blob>): Promise<Blob> {
  const zip = new JSZip()
  zip.file('projeto.json', JSON.stringify({ versao: 1, projeto }))
  for (const foto of projeto.fotos) {
    const blob = blobs.get(foto.id)
    if (!blob) continue
    zip.file(`fotos/${foto.id}${extensaoSegura(foto.nomeArquivo)}`, blob)
  }
  return zip.generateAsync({ type: 'blob' })
}

export async function desempacotarProjeto(arquivo: Blob): Promise<{ projeto: Projeto; blobs: Map<string, Blob> }> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(await arquivo.arrayBuffer())
  } catch {
    throw new Error('Este arquivo não é um projeto do pic-grid.')
  }
  const json = zip.file('projeto.json')
  if (!json) throw new Error('Este arquivo não é um projeto do pic-grid.')
  const texto = await json.async('string')
  const dados = JSON.parse(texto) as { versao?: number; projeto?: Partial<Projeto> }
  if (!dados || typeof dados !== 'object' || !dados.projeto) throw new Error('Não foi possível ler o projeto.')
  const projeto = normalizarProjeto(dados.projeto)
  const blobs = new Map<string, Blob>()
  for (const foto of projeto.fotos) {
    const entrada = Object.values(zip.files).find((item) => item.name.startsWith(`fotos/${foto.id}`) && !item.dir)
    if (!entrada) continue
    const bytes = await entrada.async('uint8array')
    blobs.set(foto.id, new Blob([bytes.slice()]))
  }
  return { projeto, blobs }
}

export function nomeArquivoProjeto(nome: string): string {
  const base = nome
    .trim()
    .replace(/[^\p{L}\p{N} _-]+/gu, '')
    .trim()
  return `${base || 'projeto'}.picgrid`
}

function extensaoSegura(nome: string): string {
  const encontrada = nome.match(/\.(jpe?g|png|webp)$/i)?.[0]?.toLowerCase() ?? '.img'
  return encontrada === '.jpeg' ? '.jpg' : encontrada
}
