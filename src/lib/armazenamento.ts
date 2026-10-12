import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Projeto } from '../tipos'

interface RegistroBlob {
  id: string
  projectId: string
  blob: Blob
}

interface Banco extends DBSchema {
  projects: {
    key: string
    value: Projeto
  }
  blobs: {
    key: string
    value: RegistroBlob
    indexes: { 'by-project': string }
  }
  meta: {
    key: string
    value: string
  }
}

let conexao: Promise<IDBPDatabase<Banco>> | null = null

function banco() {
  if (!conexao) {
    conexao = openDB<Banco>('pic-grid', 1, {
      upgrade(db) {
        db.createObjectStore('projects')
        const blobs = db.createObjectStore('blobs')
        blobs.createIndex('by-project', 'projectId')
        db.createObjectStore('meta')
      },
    })
  }
  return conexao
}

export async function salvarProjeto(projeto: Projeto, blobs: Map<string, Blob>): Promise<void> {
  const db = await banco()
  const tx = db.transaction(['projects', 'blobs', 'meta'], 'readwrite')
  await tx.objectStore('projects').put(projeto, projeto.id)
  const index = tx.objectStore('blobs').index('by-project')
  const existentes = new Set<string>()
  let cursor = await index.openCursor(projeto.id)
  while (cursor) {
    const atual = cursor
    existentes.add(atual.value.id)
    if (!projeto.fotos.some((foto) => foto.id === atual.value.id)) await atual.delete()
    cursor = await cursor.continue()
  }
  for (const foto of projeto.fotos) {
    if (existentes.has(foto.id)) continue
    const blob = blobs.get(foto.id)
    if (!blob) continue
    await tx.objectStore('blobs').put({ id: foto.id, projectId: projeto.id, blob }, foto.id)
  }
  await tx.objectStore('meta').put(projeto.id, 'lastProjectId')
  await tx.done
}

export async function carregarProjeto(id: string): Promise<{ projeto: Projeto; blobs: Map<string, Blob> } | null> {
  const db = await banco()
  const projeto = await db.get('projects', id)
  if (!projeto) return null
  const registros = await db.getAllFromIndex('blobs', 'by-project', id)
  return { projeto, blobs: new Map(registros.map((registro) => [registro.id, registro.blob])) }
}

export async function idUltimoProjeto(): Promise<string | null> {
  const db = await banco()
  return (await db.get('meta', 'lastProjectId')) ?? null
}

export async function listarProjetos(): Promise<Projeto[]> {
  const db = await banco()
  const projetos = await db.getAll('projects')
  return projetos.sort((a, b) => b.atualizadoEm - a.atualizadoEm)
}

export async function apagarProjeto(id: string): Promise<void> {
  const db = await banco()
  const tx = db.transaction(['projects', 'blobs', 'meta'], 'readwrite')
  const index = tx.objectStore('blobs').index('by-project')
  let cursor = await index.openCursor(id)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.objectStore('projects').delete(id)
  const ultimo = await tx.objectStore('meta').get('lastProjectId')
  if (ultimo === id) await tx.objectStore('meta').delete('lastProjectId')
  await tx.done
}

export async function tamanhoArmazenado(): Promise<number> {
  const db = await banco()
  const registros = await db.getAll('blobs')
  return registros.reduce((soma, registro) => soma + registro.blob.size, 0)
}
