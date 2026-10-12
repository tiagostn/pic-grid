import { describe, expect, it } from 'vitest'
import { projetoVazio } from '../tipos'
import { desempacotarProjeto, empacotarProjeto, nomeArquivoProjeto } from './arquivoProjeto'

describe('arquivo do projeto', () => {
  it('salva e recupera fotos e a legenda do grupo', async () => {
    const projeto = {
      ...projetoVazio(),
      id: 'salvo',
      nome: 'Festa da Ana',
      colunas: 3,
      tamanhoGrupo: 3,
      modoLegenda: 'grupo' as const,
      legendasGrupo: { '0-0-0': 'Turma' },
      slots: ['foto-1'],
      fotos: [
        {
          id: 'foto-1',
          nomeArquivo: 'praia.jpg',
          legenda: 'Mar',
          larguraPx: 20,
          alturaPx: 10,
          transformacao: {
            crop: { x: 0, y: 0, largura: 1, altura: 1 },
            rotacao90: 0 as const,
            espelhoHorizontal: false,
          },
        },
      ],
    }
    const blobs = new Map<string, Blob>([['foto-1', new Blob(['jpeg-falso'], { type: 'image/jpeg' })]])
    const arquivo = await empacotarProjeto(projeto, blobs)
    const aberto = await desempacotarProjeto(arquivo)
    expect(aberto.projeto.nome).toBe('Festa da Ana')
    expect(aberto.projeto.tamanhoGrupo).toBe(3)
    expect(aberto.projeto.legendasGrupo['0-0-0']).toBe('Turma')
    expect(await aberto.blobs.get('foto-1')?.text()).toBe('jpeg-falso')
    expect(nomeArquivoProjeto('Festa da Ana')).toBe('Festa da Ana.picgrid')
  })

  it('rejeita um zip sem o projeto', async () => {
    await expect(desempacotarProjeto(new Blob(['nada']))).rejects.toThrow(/pic-grid|ler o projeto|não é um projeto/i)
  })
})
