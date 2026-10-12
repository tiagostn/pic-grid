import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import JSZip from 'jszip'
import {
  COTA_BYTES,
  clonarTransformacao,
  normalizarProjeto,
  projetoVazio,
  type Dpi,
  type FormatoExportacao,
  type Foto,
  type Projeto,
  type Transformacao,
} from './tipos'
import { desempacotarProjeto, empacotarProjeto, nomeArquivoProjeto } from './lib/arquivoProjeto'
import {
  apagarProjeto,
  carregarProjeto,
  idUltimoProjeto,
  listarProjetos,
  salvarProjeto,
  tamanhoArmazenado,
} from './lib/armazenamento'
import { composeDocx } from './lib/composeDocx'
import { composePdf } from './lib/composePdf'
import { carregarFonte } from './lib/fonte'
import { bitmapOrientado, canvasParaJpeg, ehHeic, formatoAceito, renderCelula } from './lib/imagens'
import { gruposEfetivos, calcularPaginas, type PaginaLayout } from './lib/layout'
import {
  adicionarFotosNosGrupos,
  anexarFotoAoGrupo,
  incluirFotosNoGrupo,
  definirColunasDeTodos,
  definirColunasDoGrupo,
  duplicarNoGrupo,
  excluirFotoDoGrupo,
  moverFoto,
  moverGrupo as reordenarGrupo,
  slotsDosGrupos,
} from './lib/grupos'
import { renderPaginaImagem } from './lib/renderFolha'
import { salvarArquivo } from './lib/salvarArquivo'
import { temEmoji } from './lib/legenda'
import { nomeExportacao } from './lib/texto'

type Progresso = { atual: number; total: number }

export type Estado = {
  projeto: Projeto
  blobs: Map<string, Blob>
  paginas: PaginaLayout[]
  projetos: Projeto[]
  bytes: number
  hidratado: boolean
  fontePronta: boolean
  lendo: string | null
  erro: string | null
  aviso: string | null
  exportando: boolean
  progresso: Progresso | null
  selecionado: number | null
  editorId: string | null
  arrastando: boolean
  gavetaAberta: boolean
  podeInstalar: boolean
  acimaDaCota: boolean
  setGavetaAberta: (aberta: boolean) => void
  setErro: (erro: string | null) => void
  atualizar: (patch: Partial<Projeto>) => void
  adicionarArquivos: (arquivos: File[], grupoId?: string) => Promise<void>
  removerFoto: (id: string) => void
  duplicarFoto: (id: string) => void
  definirLegenda: (id: string, legenda: string) => void
  definirLegendaGrupo: (chave: string, legenda: string) => void
  legendasDosArquivos: () => void
  moverSlot: (origem: number, destino: number) => void
  anexarFoto: (origem: number, grupoId: string) => void
  moverGrupo: (origemId: string, destinoId: string) => void
  definirTamanhoDoGrupo: (grupoId: string, tamanho: number) => void
  selecionar: (indice: number | null) => void
  abrirEditor: (id: string) => void
  fecharEditor: () => void
  aplicarTransformacao: (id: string, transformacao: Transformacao) => void
  exportar: (formato?: FormatoExportacao) => Promise<void>
  salvarArquivoProjeto: () => Promise<void>
  abrirArquivoProjeto: (arquivo: File) => Promise<void>
  imprimir: () => void
  instalar: () => Promise<void>
  novoProjeto: () => Promise<void>
  abrirProjeto: (id: string) => Promise<void>
  apagarProjetoPorId: (id: string) => Promise<void>
  apagarRascunhoAtual: () => Promise<void>
  apagarExportados: () => Promise<void>
}

const Contexto = createContext<Estado | null>(null)

export function useEstado(): Estado {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useEstado fora do provedor')
  return contexto
}

export function ProvedorProjeto({ children }: { children: ReactNode }) {
  const estado = useProjeto()
  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>
}

function useProjeto(): Estado {
  const [projeto, setProjeto] = useState<Projeto>(() => projetoVazio())
  const [blobs, setBlobs] = useState<Map<string, Blob>>(() => new Map())
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [bytes, setBytes] = useState(0)
  const [hidratado, setHidratado] = useState(false)
  const [fontePronta, setFontePronta] = useState(false)
  const [lendo, setLendo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [selecionado, setSelecionado] = useState<number | null>(null)
  const [editorId, setEditorId] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [gavetaAberta, setGavetaAberta] = useState(false)
  const [podeInstalar, setPodeInstalar] = useState(false)
  const blobsRef = useRef(blobs)
  const projetoRef = useRef(projeto)
  const editorRef = useRef(editorId)
  const exportarRef = useRef<(formato?: FormatoExportacao) => Promise<void>>(async () => {})
  const fila = useRef<Promise<void>>(Promise.resolve())
  const lote = useRef({ chave: '', quando: 0 })
  const arraste = useRef(0)
  const instalacao = useRef<BeforeInstallPromptEvent | null>(null)

  blobsRef.current = blobs
  projetoRef.current = projeto
  editorRef.current = editorId

  const definirBlobs = useCallback((prox: Map<string, Blob>) => {
    blobsRef.current = prox
    setBlobs(prox)
  }, [])

  const atualizarLista = useCallback(async () => {
    const [lista, total] = await Promise.all([listarProjetos(), tamanhoArmazenado()])
    setProjetos(lista)
    setBytes(total)
  }, [])

  const enfileirar = useCallback(
    (alvo: Projeto) => {
      const copiaBlobs = new Map(blobsRef.current)
      fila.current = fila.current
        .then(() => salvarProjeto(alvo, copiaBlobs))
        .then(() => atualizarLista())
        .catch(() => {
          setErro('Não foi possível guardar o rascunho neste navegador. Exporte o arquivo para não perder a folha.')
        })
      return fila.current
    },
    [atualizarLista],
  )

  useEffect(() => {
    let ativo = true
    void (async () => {
      try {
        const id = await idUltimoProjeto()
        const carregado = id ? await carregarProjeto(id) : null
        if (!ativo) return
        if (carregado) {
          const projeto = normalizarProjeto(carregado.projeto)
          definirBlobs(carregado.blobs)
          setProjeto(projeto)
          const faltando = projeto.fotos.some((foto) => !carregado.blobs.has(foto.id))
          if (faltando) setAviso('Algumas fotos do rascunho não foram encontradas.')
        }
        await atualizarLista()
      } catch {
        if (ativo) setErro('Não foi possível abrir o rascunho salvo neste navegador.')
      } finally {
        if (ativo) setHidratado(true)
      }
    })()
    return () => {
      ativo = false
    }
  }, [atualizarLista, definirBlobs])

  useEffect(() => {
    if (!hidratado) return
    const timer = window.setTimeout(() => {
      void enfileirar(projetoRef.current)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [projeto, hidratado, enfileirar])

  useEffect(() => {
    void carregarFonte()
      .then(() => setFontePronta(true))
      .catch(() => setErro('Não foi possível carregar a fonte das legendas.'))
  }, [])

  useEffect(() => {
    const aoPrompt = (evento: Event) => {
      evento.preventDefault()
      instalacao.current = evento as BeforeInstallPromptEvent
      setPodeInstalar(true)
    }
    window.addEventListener('beforeinstallprompt', aoPrompt)
    return () => window.removeEventListener('beforeinstallprompt', aoPrompt)
  }, [])

  const paginas = useMemo(() => calcularPaginas(projeto), [projeto])

  const atualizar = useCallback((patch: Partial<Projeto>) => {
    setProjeto((atual) => {
      const colunas = patch.colunas != null ? inteiro(patch.colunas, 1, 10) : atual.colunas
      const tamanhoGrupo = patch.tamanhoGrupo != null ? inteiro(patch.tamanhoGrupo, 1, 10) : atual.tamanhoGrupo
      const proximo = {
        ...atual,
        ...patch,
        colunas,
        linhas: patch.linhas != null ? inteiro(patch.linhas, 1, 10) : atual.linhas,
        tamanhoGrupo,
        margemMm: patch.margemMm != null ? faixa(patch.margemMm, 0, 50) : atual.margemMm,
        espacoMm: patch.espacoMm != null ? faixa(patch.espacoMm, 0, 30) : atual.espacoMm,
        fonteLegendaPt: patch.fonteLegendaPt != null ? faixa(patch.fonteLegendaPt, 6, 24) : atual.fonteLegendaPt,
        bordaInternaMm: patch.bordaInternaMm != null ? faixa(patch.bordaInternaMm, 0, 20) : atual.bordaInternaMm,
        qualidadeJpeg: patch.qualidadeJpeg != null ? faixa(patch.qualidadeJpeg, 0.7, 0.95) : atual.qualidadeJpeg,
        dpi: (patch.dpi ?? atual.dpi) as Dpi,
        atualizadoEm: Date.now(),
      }
      if (patch.tamanhoGrupo == null || tamanhoGrupo === atual.tamanhoGrupo) return proximo
      const grupos = definirColunasDeTodos(gruposEfetivos(atual), tamanhoGrupo)
      if (grupos.length === 0) return proximo
      return gravarGrupos(proximo, grupos)
    })
  }, [])

  const adicionarArquivos = useCallback(
    async (arquivos: File[], grupoId?: string) => {
      if (arquivos.length === 0) return
      const chave = arquivos.map((arquivo) => `${arquivo.name}:${arquivo.size}:${arquivo.lastModified}`).join('|')
      const agora = Date.now()
      if (chave === lote.current.chave && agora - lote.current.quando < 800) return
      lote.current = { chave, quando: agora }

      const ordenados = [...arquivos].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))
      const erros: string[] = []
      const novas: Foto[] = []
      const proximosBlobs = new Map(blobsRef.current)
      if (ordenados.some((arquivo) => ehHeic(arquivo.name, arquivo.type))) {
        setAviso('Converter HEIC pode demorar e usar bastante memória.')
      }

      for (let i = 0; i < ordenados.length; i += 1) {
        const arquivo = ordenados[i]
        if (!arquivo) continue
        setLendo(`Lendo ${i + 1} de ${ordenados.length}`)
        if (!formatoAceito(arquivo.name, arquivo.type)) {
          erros.push(`${arquivo.name}: formato não suportado`)
          continue
        }
        try {
          let blob: Blob = arquivo
          let nome = arquivo.name
          if (ehHeic(arquivo.name, arquivo.type)) {
            setLendo(`Convertendo HEIC ${i + 1} de ${ordenados.length}`)
            const heic2any = (await import('heic2any')).default
            const convertido = await heic2any({ blob: arquivo, toType: 'image/jpeg', quality: 0.92 })
            blob = Array.isArray(convertido) ? convertido[0] : convertido
            nome = nome.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg')
          }
          const bitmap = await bitmapOrientado(blob)
          const id = crypto.randomUUID()
          novas.push({
            id,
            nomeArquivo: nome,
            legenda: '',
            larguraPx: bitmap.width,
            alturaPx: bitmap.height,
            transformacao: { crop: { x: 0, y: 0, largura: 1, altura: 1 }, rotacao90: 0, espelhoHorizontal: false },
          })
          proximosBlobs.set(id, blob)
        } catch {
          erros.push(`${arquivo.name}: não foi possível ler a imagem`)
        }
      }

      setLendo(null)
      if (novas.length > 0) {
        definirBlobs(proximosBlobs)
        setProjeto((atual) => {
          const fotos = [...atual.fotos, ...novas]
          const ids = novas.map((foto) => foto.id)
          const grupos = grupoId
            ? incluirFotosNoGrupo(gruposEfetivos(atual), grupoId, ids)
            : adicionarFotosNosGrupos(gruposEfetivos(atual), ids, atual.tamanhoGrupo)
          return gravarGrupos({ ...atual, fotos }, grupos)
        })
        setSelecionado((atual) => atual ?? 0)
      }
      setErro(erros.length ? erros.join(' ') : null)
    },
    [definirBlobs],
  )

  const removerFoto = useCallback((id: string) => {
    const proximos = new Map(blobsRef.current)
    proximos.delete(id)
    definirBlobs(proximos)
    setProjeto((atual) =>
      gravarGrupos(
        { ...atual, fotos: atual.fotos.filter((foto) => foto.id !== id) },
        excluirFotoDoGrupo(gruposEfetivos(atual), id),
      ),
    )
    setEditorId((atual) => (atual === id ? null : atual))
  }, [definirBlobs])

  const duplicarFoto = useCallback((id: string) => {
    const foto = projetoRef.current.fotos.find((item) => item.id === id)
    const blob = blobsRef.current.get(id)
    if (!foto || !blob) return
    const novoId = crypto.randomUUID()
    const copia: Foto = { ...foto, id: novoId, transformacao: clonarTransformacao(foto.transformacao) }
    const proximos = new Map(blobsRef.current)
    proximos.set(novoId, blob)
    definirBlobs(proximos)
    setProjeto((atual) => {
      const grupos = duplicarNoGrupo(gruposEfetivos(atual), id, novoId)
      return gravarGrupos({ ...atual, fotos: [...atual.fotos, copia] }, grupos)
    })
  }, [definirBlobs])

  const definirLegenda = useCallback((id: string, legenda: string) => {
    setProjeto((atual) => ({
      ...atual,
      atualizadoEm: Date.now(),
      fotos: atual.fotos.map((foto) => (foto.id === id ? { ...foto, legenda } : foto)),
    }))
  }, [])

  const definirLegendaGrupo = useCallback((grupoId: string, legenda: string) => {
    setProjeto((atual) => {
      const grupos = gruposEfetivos(atual).map((grupo) => (grupo.id === grupoId ? { ...grupo, legenda } : grupo))
      return gravarGrupos(atual, grupos)
    })
  }, [])

  const legendasDosArquivos = useCallback(() => {
    setProjeto((atual) => {
      const fotos = atual.fotos.map((foto) => ({
        ...foto,
        legenda: foto.nomeArquivo.replace(/\.[^.]+$/, ''),
      }))
      const grupos = gruposEfetivos(atual).map((grupo) => {
        if (atual.modoLegenda !== 'grupo') return grupo
        const nomes = grupo.slots
          .map((id) => fotos.find((foto) => foto.id === id)?.legenda)
          .filter((nome): nome is string => Boolean(nome))
        return { ...grupo, legenda: nomes.join(', ') }
      })
      return gravarGrupos({ ...atual, fotos, legendasLigadas: true }, grupos)
    })
  }, [])

  const moverSlot = useCallback((origem: number, destino: number) => {
    if (origem === destino || origem < 0 || destino < 0) return
    setProjeto((atual) => gravarGrupos(atual, moverFoto(gruposEfetivos(atual), origem, destino)))
    setSelecionado(destino)
  }, [])

  const anexarFoto = useCallback((origem: number, grupoId: string) => {
    if (origem < 0 || !grupoId) return
    setProjeto((atual) => gravarGrupos(atual, anexarFotoAoGrupo(gruposEfetivos(atual), origem, grupoId)))
  }, [])

  const moverGrupo = useCallback((origemId: string, destinoId: string) => {
    if (!origemId || !destinoId || origemId === destinoId) return
    setProjeto((atual) => gravarGrupos(atual, reordenarGrupo(gruposEfetivos(atual), origemId, destinoId)))
  }, [])

  const definirTamanhoDoGrupo = useCallback((grupoId: string, tamanho: number) => {
    setProjeto((atual) => gravarGrupos(atual, definirColunasDoGrupo(gruposEfetivos(atual), grupoId, tamanho)))
  }, [])

  const aplicarTransformacao = useCallback((id: string, transformacao: Transformacao) => {
    setProjeto((atual) => ({
      ...atual,
      atualizadoEm: Date.now(),
      fotos: atual.fotos.map((foto) =>
        foto.id === id ? { ...foto, transformacao: clonarTransformacao(transformacao) } : foto,
      ),
    }))
    setEditorId(null)
  }, [])

  const exportar = useCallback(async (formato?: FormatoExportacao) => {
    if (exportando) return
    const atual = projetoRef.current
    const escolhido = formato ?? atual.formatoExportacao
    const folhas = calcularPaginas(atual)
    if (folhas.some((pagina) => !pagina.valida)) {
      setErro('A grade não cabe na folha. Reduza margens, espaçamento, fonte ou o número de células.')
      return
    }
    setExportando(true)
    setErro(null)
    try {
      const fonte = new Uint8Array(await carregarFonte())
      const textos = [
        ...atual.fotos.map((foto) => foto.legenda),
        atual.cabecalho,
        ...Object.values(atual.legendasGrupo),
      ]
      if (textos.some((texto) => temEmoji(texto))) setAviso('Emojis foram omitidos das legendas.')

      if (escolhido === 'pdf') {
        const imagens = new Map<number, Uint8Array>()
        for (let i = 0; i < folhas.length; i += 1) {
          const pagina = folhas[i]
          if (!pagina) continue
          setProgresso({ atual: i + 1, total: folhas.length })
          await ceder()
          for (const celula of pagina.celulas) {
            if (!celula.fotoId) continue
            const foto = atual.fotos.find((item) => item.id === celula.fotoId)
            const blob = foto ? blobsRef.current.get(foto.id) : undefined
            if (!foto || !blob) throw new Error('Uma foto do rascunho não está mais disponível.')
            try {
              const canvas = await renderCelula(
                blob,
                foto.transformacao,
                Math.max(1, Math.round((celula.foto.w / 25.4) * atual.dpi)),
                Math.max(1, Math.round((celula.foto.h / 25.4) * atual.dpi)),
                atual.encaixe,
              )
              imagens.set(celula.slotIndex, await canvasParaJpeg(canvas, atual.qualidadeJpeg))
            } catch {
              throw new Error(`Não foi possível processar ${foto.nomeArquivo}.`)
            }
          }
        }
        const pdf = await composePdf({
          paginas: folhas,
          imagens,
          fonteBytes: fonte,
          fontePt: atual.fonteLegendaPt,
          alinhamento: atual.alinhamentoLegenda,
          guiasCorte: atual.guiasCorte,
        })
        await salvarArquivo(bytesParaBlob(pdf, 'application/pdf'), nomeExportacao('pdf'), 'application/pdf', '.pdf', 'PDF')
      } else if (escolhido === 'docx') {
        const imagens = await jpegsDasCelulas(folhas, atual, blobsRef.current, setProgresso)
        const docx = await composeDocx({ projeto: atual, paginas: folhas, imagens })
        await salvarArquivo(
          bytesParaBlob(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
          nomeExportacao('docx'),
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.docx',
          'DOCX',
        )
      } else {
        const saidas: Blob[] = []
        const mapa = new Map<string, { blob: Blob; foto: Foto }>()
        for (const foto of atual.fotos) {
          const blob = blobsRef.current.get(foto.id)
          if (blob) mapa.set(foto.id, { blob, foto })
        }
        for (let i = 0; i < folhas.length; i += 1) {
          const pagina = folhas[i]
          if (!pagina) continue
          const ausente = pagina.celulas.find((celula) => celula.fotoId && !mapa.has(celula.fotoId))
          if (ausente) throw new Error('Uma foto do rascunho não está mais disponível.')
          setProgresso({ atual: i + 1, total: folhas.length })
          await ceder()
          try {
            saidas.push(
              await renderPaginaImagem({
                pagina,
                fotos: mapa,
                dpi: atual.dpi,
                qualidade: atual.qualidadeJpeg,
                encaixe: atual.encaixe,
                alinhamento: atual.alinhamentoLegenda,
                fontePt: atual.fonteLegendaPt,
                guias: atual.guiasCorte,
                formato: escolhido,
              }),
            )
          } catch {
            throw new Error(`Não foi possível gerar a página ${i + 1}.`)
          }
        }
        if (saidas.length === 1 && saidas[0]) {
          const extensao = escolhido === 'jpeg' ? 'jpg' : 'png'
          const mime = escolhido === 'jpeg' ? 'image/jpeg' : 'image/png'
          await salvarArquivo(saidas[0], nomeExportacao(extensao), mime, `.${extensao}`, escolhido === 'jpeg' ? 'JPEG' : 'PNG')
        } else {
          const zip = new JSZip()
          const extensao = escolhido === 'jpeg' ? 'jpg' : 'png'
          saidas.forEach((blob, indice) => {
            zip.file(`pagina-${String(indice + 1).padStart(2, '0')}.${extensao}`, blob)
          })
          const arquivo = await zip.generateAsync({ type: 'blob' })
          await salvarArquivo(arquivo, nomeExportacao('zip'), 'application/zip', '.zip', 'ZIP')
        }
      }

      setProjeto((corrente) => ({
        ...corrente,
        formatoExportacao: escolhido,
        exportadoEm: Date.now(),
        atualizadoEm: Date.now(),
      }))
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === 'AbortError') return
      setErro(erro instanceof Error ? erro.message : 'Falha ao exportar.')
    } finally {
      setExportando(false)
      setProgresso(null)
    }
  }, [exportando])

  exportarRef.current = exportar

  useEffect(() => {
    const aoTecla = (evento: KeyboardEvent) => {
      const alvo = evento.target
      const digitando = alvo instanceof HTMLElement && Boolean(alvo.closest('input, textarea, [contenteditable="true"]'))
      if ((evento.ctrlKey || evento.metaKey) && evento.key === 'Enter') {
        if (editorRef.current) return
        evento.preventDefault()
        void exportarRef.current()
        return
      }
      if (digitando || editorRef.current) return
      if (evento.key === 'Delete' || evento.key === 'Backspace') {
        const indice = selecionado
        if (indice == null) return
        const id = projetoRef.current.slots[indice]
        if (!id) return
        evento.preventDefault()
        removerFoto(id)
        return
      }
      const deslocamento =
        evento.key === 'ArrowRight' ? [1, 0] : evento.key === 'ArrowLeft' ? [-1, 0] : evento.key === 'ArrowDown' ? [0, 1] : evento.key === 'ArrowUp' ? [0, -1] : null
      if (!deslocamento) return
      evento.preventDefault()
      const [dc, dl] = deslocamento
      const colunas = Math.min(10, Math.max(1, Math.round(projetoRef.current.colunas)))
      const total = calcularPaginas(projetoRef.current).reduce((soma, pagina) => soma + pagina.celulas.length, 0)
      const atual = selecionado ?? 0
      const coluna = atual % colunas
      const linha = Math.floor(atual / colunas)
      const novaColuna = coluna + dc
      const novaLinha = linha + dl
      if (novaColuna < 0 || novaColuna >= colunas) return
      const indice = novaLinha * colunas + novaColuna
      if (indice < 0 || indice >= total) return
      setSelecionado(indice)
    }
    window.addEventListener('keydown', aoTecla)
    return () => window.removeEventListener('keydown', aoTecla)
  }, [removerFoto, selecionado])

  useEffect(() => {
    const temArquivo = (evento: DragEvent) => Array.from(evento.dataTransfer?.types ?? []).includes('Files')
    const entrar = (evento: DragEvent) => {
      if (!temArquivo(evento)) return
      evento.preventDefault()
      arraste.current += 1
      setArrastando(true)
    }
    const sair = (evento: DragEvent) => {
      if (!temArquivo(evento)) return
      arraste.current -= 1
      if (arraste.current <= 0) {
        arraste.current = 0
        setArrastando(false)
      }
    }
    const sobre = (evento: DragEvent) => {
      if (temArquivo(evento)) evento.preventDefault()
    }
    const soltar = (evento: DragEvent) => {
      if (!temArquivo(evento)) return
      evento.preventDefault()
      arraste.current = 0
      setArrastando(false)
      const arquivos = Array.from(evento.dataTransfer?.files ?? [])
      if (arquivos.length) void adicionarArquivos(arquivos)
    }
    window.addEventListener('dragenter', entrar)
    window.addEventListener('dragleave', sair)
    window.addEventListener('dragover', sobre)
    window.addEventListener('drop', soltar)
    return () => {
      window.removeEventListener('dragenter', entrar)
      window.removeEventListener('dragleave', sair)
      window.removeEventListener('dragover', sobre)
      window.removeEventListener('drop', soltar)
    }
  }, [adicionarArquivos])

  const imprimir = useCallback(() => {
    let estilo = document.getElementById('pic-grid-print')
    if (!estilo) {
      estilo = document.createElement('style')
      estilo.id = 'pic-grid-print'
      document.head.appendChild(estilo)
    }
    const orientacao = projetoRef.current.orientacao === 'paisagem' ? 'landscape' : 'portrait'
    estilo.textContent = `@page { size: A4 ${orientacao}; margin: 0; }`
    window.print()
  }, [])

  const instalar = useCallback(async () => {
    const evento = instalacao.current
    if (!evento) return
    await evento.prompt()
    instalacao.current = null
    setPodeInstalar(false)
  }, [])

  const salvarArquivoProjeto = useCallback(async () => {
    try {
      const arquivo = await empacotarProjeto(projetoRef.current, blobsRef.current)
      await salvarArquivo(arquivo, nomeArquivoProjeto(projetoRef.current.nome), 'application/zip', '.picgrid', 'Projeto pic-grid')
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === 'AbortError') return
      setErro(erro instanceof Error ? erro.message : 'Não foi possível salvar o projeto.')
    }
  }, [])

  const abrirArquivoProjeto = useCallback(
    async (arquivo: File) => {
      if (projetoRef.current.fotos.length > 0 && !window.confirm('Abrir este arquivo no lugar da folha atual?')) return
      try {
        const aberto = await desempacotarProjeto(arquivo)
        const faltando = aberto.projeto.fotos.some((foto) => !aberto.blobs.has(foto.id))
        definirBlobs(aberto.blobs)
        setProjeto(aberto.projeto)
        setSelecionado(null)
        setEditorId(null)
        setAviso(faltando ? 'Algumas fotos do arquivo não foram encontradas.' : null)
        setErro(null)
      } catch (erro) {
        setErro(erro instanceof Error ? erro.message : 'Não foi possível abrir o projeto.')
      }
    },
    [definirBlobs],
  )

  const novoProjeto = useCallback(async () => {
    await enfileirar(projetoRef.current)
    definirBlobs(new Map())
    setProjeto(projetoVazio())
    setSelecionado(null)
    setEditorId(null)
    setGavetaAberta(false)
  }, [definirBlobs, enfileirar])

  const abrirProjeto = useCallback(
    async (id: string) => {
      if (id === projetoRef.current.id) {
        setGavetaAberta(false)
        return
      }
      await enfileirar(projetoRef.current)
      const carregado = await carregarProjeto(id)
      if (!carregado) {
        setErro('Projeto não encontrado.')
        return
      }
      definirBlobs(carregado.blobs)
      setProjeto(normalizarProjeto(carregado.projeto))
      setSelecionado(null)
      setEditorId(null)
      setGavetaAberta(false)
    },
    [definirBlobs, enfileirar],
  )

  const apagarProjetoPorId = useCallback(
    async (id: string) => {
      await apagarProjeto(id)
      if (id === projetoRef.current.id) {
        const restante = (await listarProjetos()).find((item) => item.id !== id)
        if (restante) {
          const carregado = await carregarProjeto(restante.id)
          if (carregado) {
            definirBlobs(carregado.blobs)
            setProjeto(normalizarProjeto(carregado.projeto))
          }
        } else {
          definirBlobs(new Map())
          setProjeto(projetoVazio())
        }
        setSelecionado(null)
        setEditorId(null)
      }
      await atualizarLista()
    },
    [atualizarLista, definirBlobs],
  )

  const apagarRascunhoAtual = useCallback(async () => {
    if (!window.confirm('Apagar esta folha e as fotos guardadas nela?')) return
    await apagarProjetoPorId(projetoRef.current.id)
  }, [apagarProjetoPorId])

  const apagarExportados = useCallback(async () => {
    const lista = await listarProjetos()
    for (const item of lista) {
      if (item.id === projetoRef.current.id || !item.exportadoEm) continue
      await apagarProjeto(item.id)
    }
    await atualizarLista()
  }, [atualizarLista])

  return {
    projeto,
    blobs,
    paginas,
    projetos,
    bytes,
    hidratado,
    fontePronta,
    lendo,
    erro,
    aviso,
    exportando,
    progresso,
    selecionado,
    editorId,
    arrastando,
    gavetaAberta,
    podeInstalar,
    acimaDaCota: bytes > COTA_BYTES,
    setGavetaAberta,
    setErro,
    atualizar,
    adicionarArquivos,
    removerFoto,
    duplicarFoto,
    definirLegenda,
    definirLegendaGrupo,
    legendasDosArquivos,
    moverSlot,
    anexarFoto,
    moverGrupo,
    definirTamanhoDoGrupo,
    selecionar: setSelecionado,
    abrirEditor: setEditorId,
    fecharEditor: () => setEditorId(null),
    aplicarTransformacao,
    exportar,
    salvarArquivoProjeto,
    abrirArquivoProjeto,
    imprimir,
    instalar,
    novoProjeto,
    abrirProjeto,
    apagarProjetoPorId,
    apagarRascunhoAtual,
    apagarExportados,
  }
}

function gravarGrupos(atual: Projeto, grupos: Projeto['grupos']): Projeto {
  return { ...atual, grupos, slots: slotsDosGrupos(grupos), atualizadoEm: Date.now() }
}

function inteiro(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(faixa(valor, min, max))))
}

function faixa(valor: number, min: number, max: number): number {
  if (!Number.isFinite(valor)) return min
  return Math.min(max, Math.max(min, valor))
}

function ceder() {
  return new Promise((resolve) => window.setTimeout(resolve, 0))
}

function bytesParaBlob(bytes: Uint8Array, tipo: string): Blob {
  const copia = new Uint8Array(bytes.byteLength)
  copia.set(bytes)
  return new Blob([copia], { type: tipo })
}

async function jpegsDasCelulas(
  folhas: PaginaLayout[],
  atual: Projeto,
  blobs: Map<string, Blob>,
  aoProgresso: (valor: { atual: number; total: number }) => void,
): Promise<Map<number, Uint8Array>> {
  const imagens = new Map<number, Uint8Array>()
  for (let i = 0; i < folhas.length; i += 1) {
    const pagina = folhas[i]
    if (!pagina) continue
    aoProgresso({ atual: i + 1, total: folhas.length })
    await ceder()
    for (const celula of pagina.celulas) {
      if (!celula.fotoId) continue
      const foto = atual.fotos.find((item) => item.id === celula.fotoId)
      const blob = foto ? blobs.get(foto.id) : undefined
      if (!foto || !blob) throw new Error('Uma foto do rascunho não está mais disponível.')
      try {
        const canvas = await renderCelula(
          blob,
          foto.transformacao,
          Math.max(1, Math.round((celula.foto.w / 25.4) * atual.dpi)),
          Math.max(1, Math.round((celula.foto.h / 25.4) * atual.dpi)),
          atual.encaixe,
        )
        imagens.set(celula.slotIndex, await canvasParaJpeg(canvas, atual.qualidadeJpeg))
      } catch {
        throw new Error(`Não foi possível processar ${foto.nomeArquivo}.`)
      }
    }
  }
  return imagens
}
