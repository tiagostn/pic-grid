import type { GrupoFolha } from '../tipos'

export function slotsDosGrupos(grupos: GrupoFolha[]): (string | null)[] {
  return grupos.flatMap((grupo) => grupo.slots)
}

export function clonarGrupos(grupos: GrupoFolha[]): GrupoFolha[] {
  return grupos.map((grupo) => ({ ...grupo, slots: [...grupo.slots] }))
}

export function moverFoto(grupos: GrupoFolha[], origem: number, destino: number): GrupoFolha[] {
  const total = grupos.reduce((soma, grupo) => soma + grupo.slots.length, 0)
  if (origem === destino || origem < 0 || destino < 0 || origem >= total || destino >= total) return grupos
  const copia = clonarGrupos(grupos)
  const de = localizar(copia, origem)
  const para = localizar(copia, destino)
  if (!de || !para) return grupos
  const foto = copia[de.grupo]?.slots[de.slot] ?? null
  if (!foto) return grupos
  if (de.grupo === para.grupo) {
    const outra = copia[para.grupo]?.slots[para.slot] ?? null
    copia[de.grupo]!.slots[de.slot] = outra
    copia[para.grupo]!.slots[para.slot] = foto
    return copia
  }
  copia[de.grupo]!.slots[de.slot] = null
  const ocupado = copia[para.grupo]?.slots[para.slot]
  if (ocupado == null) copia[para.grupo]!.slots[para.slot] = foto
  else copia[para.grupo]!.slots.splice(para.slot, 0, foto)
  return copia
}

export function anexarFotoAoGrupo(grupos: GrupoFolha[], origem: number, grupoId: string): GrupoFolha[] {
  const copia = clonarGrupos(grupos)
  const de = localizar(copia, origem)
  const destino = copia.findIndex((grupo) => grupo.id === grupoId)
  if (!de || destino < 0 || de.grupo === destino) return grupos
  const foto = copia[de.grupo]?.slots[de.slot] ?? null
  if (!foto) return grupos
  copia[de.grupo]!.slots[de.slot] = null
  copia[destino]?.slots.push(foto)
  return copia
}

export function incluirFotosNoGrupo(grupos: GrupoFolha[], grupoId: string, fotoIds: string[]): GrupoFolha[] {
  if (fotoIds.length === 0) return grupos
  const copia = clonarGrupos(grupos)
  const grupo = copia.find((item) => item.id === grupoId)
  if (!grupo) return grupos
  grupo.slots.push(...fotoIds)
  return copia
}

export function moverGrupo(grupos: GrupoFolha[], origemId: string, destinoId: string): GrupoFolha[] {
  const origem = grupos.findIndex((grupo) => grupo.id === origemId)
  const destino = grupos.findIndex((grupo) => grupo.id === destinoId)
  if (origem < 0 || destino < 0 || origem === destino) return grupos
  const copia = clonarGrupos(grupos)
  const [grupo] = copia.splice(origem, 1)
  if (!grupo) return grupos
  copia.splice(destino, 0, grupo)
  return copia
}

export function excluirFotoDoGrupo(grupos: GrupoFolha[], fotoId: string): GrupoFolha[] {
  return grupos.map((grupo) => ({
    ...grupo,
    slots: grupo.slots.map((slot) => (slot === fotoId ? null : slot)),
  }))
}

export function definirColunasDoGrupo(grupos: GrupoFolha[], grupoId: string, colunas: number, maximo = 10): GrupoFolha[] {
  const copia = clonarGrupos(grupos)
  const grupo = copia.find((item) => item.id === grupoId)
  if (!grupo) return copia
  grupo.colunas = Math.min(maximo, Math.max(1, Math.round(colunas)))
  return copia
}

export function definirColunasDeTodos(grupos: GrupoFolha[], colunas: number, maximo = 10): GrupoFolha[] {
  const n = Math.min(maximo, Math.max(1, Math.round(colunas)))
  return clonarGrupos(grupos).map((grupo) => ({ ...grupo, colunas: n }))
}

export function adicionarFotosNosGrupos(grupos: GrupoFolha[], fotoIds: string[], tamanhoNovo: number): GrupoFolha[] {
  const copia = clonarGrupos(grupos)
  const tamanho = Math.min(10, Math.max(1, Math.round(tamanhoNovo)))
  let atual: GrupoFolha | null = null
  for (const fotoId of fotoIds) {
    if (!atual || atual.slots.length >= tamanho) {
      atual = { id: crypto.randomUUID(), legenda: '', colunas: tamanho, slots: [] }
      copia.push(atual)
    }
    atual.slots.push(fotoId)
  }
  return copia
}

export function duplicarNoGrupo(grupos: GrupoFolha[], fotoId: string, novoId: string, maximo = 10): GrupoFolha[] {
  const copia = clonarGrupos(grupos)
  for (let indice = 0; indice < copia.length; indice += 1) {
    const grupo = copia[indice]
    if (!grupo) continue
    const posicao = grupo.slots.indexOf(fotoId)
    if (posicao < 0) continue
    if (grupo.slots.length < maximo) grupo.slots.splice(posicao + 1, 0, novoId)
    else copia.splice(indice + 1, 0, { id: crypto.randomUUID(), legenda: '', colunas: grupo.colunas, slots: [novoId] })
    return copia
  }
  copia.push({ id: crypto.randomUUID(), legenda: '', colunas: 1, slots: [novoId] })
  return copia
}

export function lerArraste(texto: string): { tipo: 'foto' | 'grupo'; id: string } | null {
  if (texto.startsWith('grupo:')) return { tipo: 'grupo', id: texto.slice(6) }
  if (texto.startsWith('foto:')) return { tipo: 'foto', id: texto.slice(5) }
  if (/^\d+$/.test(texto)) return { tipo: 'foto', id: texto }
  return null
}

function localizar(grupos: GrupoFolha[], indice: number): { grupo: number; slot: number } | null {
  let cursor = 0
  for (let grupo = 0; grupo < grupos.length; grupo += 1) {
    const tamanho = grupos[grupo]?.slots.length ?? 0
    if (indice < cursor + tamanho) return { grupo, slot: indice - cursor }
    cursor += tamanho
  }
  return null
}
