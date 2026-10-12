import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ActionIcon, Button, Slider } from '@mantine/core'
import { dpiEfetivo, fotoDoSlot, type PaginaLayout } from '../lib/layout'
import { lerArraste } from '../lib/grupos'
import { FAMILIA_FONTE } from '../lib/fonte'
import { renderCelula } from '../lib/imagens'
import { wrapCaption } from '../lib/legenda'
import { useEstado } from '../estado'
import type { Projeto } from '../tipos'

const ZOOM_MIN = 25
const ZOOM_MAX = 300
type ZoomPagina = 'ajustar' | number

export function Previa() {
  const { paginas, projeto } = useEstado()
  const [zoom, setZoom] = useState<ZoomPagina>('ajustar')
  const area = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = area.current
    if (!el) return
    const aoRolar = (evento: WheelEvent) => {
      if (!evento.ctrlKey && !evento.metaKey) return
      evento.preventDefault()
      const passo = evento.deltaY < 0 ? 10 : -10
      setZoom((atual) => limitarZoom((atual === 'ajustar' ? 100 : atual) + passo))
    }
    el.addEventListener('wheel', aoRolar, { passive: false })
    return () => el.removeEventListener('wheel', aoRolar)
  }, [])

  function mudar(passo: number) {
    setZoom((atual) => limitarZoom((atual === 'ajustar' ? 100 : atual) + passo))
  }

  return (
    <main className="previa" ref={area}>
      <div className="zoom-barra no-print">
        <ActionIcon
          variant="default"
          aria-label="Diminuir zoom"
          disabled={zoom !== 'ajustar' && zoom <= ZOOM_MIN}
          onClick={() => mudar(-10)}
        >
          −
        </ActionIcon>
        <Slider
          className="zoom-slider"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={5}
          value={zoom === 'ajustar' ? 100 : zoom}
          onChange={setZoom}
          label={(valor) => `${valor}%`}
          aria-label="Zoom da página"
        />
        <span className="zoom-valor">{zoom === 'ajustar' ? 'Ajustar' : `${zoom}%`}</span>
        <ActionIcon
          variant="default"
          aria-label="Aumentar zoom"
          disabled={zoom !== 'ajustar' && zoom >= ZOOM_MAX}
          onClick={() => mudar(10)}
        >
          +
        </ActionIcon>
        <Button size="xs" variant={zoom === 'ajustar' ? 'filled' : 'default'} onClick={() => setZoom('ajustar')}>
          Ajustar
        </Button>
      </div>
      {paginas.map((pagina) => (
        <Folha key={pagina.indice} pagina={pagina} projeto={projeto} zoom={zoom} />
      ))}
    </main>
  )
}

function limitarZoom(valor: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(valor)))
}

function Folha({ pagina, projeto, zoom }: { pagina: PaginaLayout; projeto: Projeto; zoom: ZoomPagina }) {
  const { blobs, selecionado, selecionar, abrirEditor, moverSlot, anexarFoto, moverGrupo, fontePronta } = useEstado()
  const [largura, setLargura] = useState(0)
  const [no, setNo] = useState<HTMLDivElement | null>(null)
  const urls = useMiniaturas(pagina, projeto, blobs)

  useEffect(() => {
    if (!no) return
    const observar = new ResizeObserver(() => setLargura(no.clientWidth))
    observar.observe(no)
    setLargura(no.clientWidth)
    return () => observar.disconnect()
  }, [no])

  const pxPorMm = largura > 0 ? largura / pagina.larguraMm : 0

  return (
    <section className="folha-quadro">
      <p className="no-print" style={{ textAlign: 'center', margin: '0 0 8px', color: '#495057' }}>
        Página {pagina.indice + 1}
      </p>
      <div
        ref={setNo}
        className={`folha ${zoom === 'ajustar' ? 'folha-ajustar' : 'folha-zoom'}`}
        style={{
          aspectRatio: `${pagina.larguraMm} / ${pagina.alturaMm}`,
          ['--page-w' as string]: `${pagina.larguraMm}mm`,
          ['--page-h' as string]: `${pagina.alturaMm}mm`,
          ['--zoom' as string]: zoom === 'ajustar' ? '1' : String(zoom / 100),
        }}
      >
        {pagina.cabecalho ? (
          <div
            className="legenda-folha"
            style={{
              ...posicao(pagina.cabecalho, pagina),
              fontSize: pxPorMm > 0 ? `${(Math.max(projeto.fonteLegendaPt, 11) * 25.4 * pxPorMm) / 72}px` : '12px',
              padding: '0 1.5mm',
              boxSizing: 'border-box',
            }}
          >
            {pagina.cabecalho.texto}
          </div>
        ) : null}
        {pagina.grupos.map((grupo) => {
          const primeira = grupo.celulas[0]
          if (!primeira) return null
          return (
            <button
              key={`grupo-${grupo.id}`}
              type="button"
              className="alca-grupo no-print"
              style={{ left: posicao(primeira.celula, pagina).left, top: posicao(primeira.celula, pagina).top }}
              draggable
              aria-label="Mover grupo"
              onClick={(evento) => evento.stopPropagation()}
              onDragStart={(evento) => {
                evento.stopPropagation()
                evento.dataTransfer.setData('text/plain', `grupo:${grupo.id}`)
                evento.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(evento) => {
                evento.preventDefault()
                evento.stopPropagation()
              }}
              onDrop={(evento) => {
                evento.preventDefault()
                evento.stopPropagation()
                const dados = lerArraste(evento.dataTransfer.getData('text/plain'))
                if (dados?.tipo === 'foto') anexarFoto(Number(dados.id), grupo.id)
                if (dados?.tipo === 'grupo') moverGrupo(dados.id, grupo.id)
              }}
            >
              Grupo
            </button>
          )
        })}
        {pagina.celulas.map((celula) => {
          const foto = fotoDoSlot(projeto, celula.fotoId)
          const dpi = foto && celula.foto.w > 0 ? dpiEfetivo(foto, celula.foto.w, celula.foto.h, projeto.encaixe, projeto.dpi) : projeto.dpi
          return (
            <div
              key={celula.fotoId ?? `vazio-${celula.slotIndex}`}
              role="button"
              tabIndex={0}
              className={`celula${celula.fotoId ? '' : ' vazia'}${selecionado === celula.slotIndex ? ' selecionada' : ''}${projeto.guiasCorte ? ' guias' : ''}`}
              style={posicao(celula.celula, pagina)}
              draggable={Boolean(celula.fotoId)}
              onClick={() => {
                selecionar(celula.slotIndex)
                if (celula.fotoId) abrirEditor(celula.fotoId)
              }}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter' && celula.fotoId) abrirEditor(celula.fotoId)
              }}
              onDragStart={(evento) => {
                evento.stopPropagation()
                evento.dataTransfer.setData('text/plain', `foto:${celula.slotIndex}`)
                evento.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(evento) => {
                evento.preventDefault()
                evento.stopPropagation()
              }}
              onDrop={(evento) => {
                evento.preventDefault()
                evento.stopPropagation()
                const dados = lerArraste(evento.dataTransfer.getData('text/plain'))
                if (dados?.tipo === 'foto') moverSlot(Number(dados.id), celula.slotIndex)
                if (dados?.tipo === 'grupo' && celula.grupoId) moverGrupo(dados.id, celula.grupoId)
              }}
            >
              {celula.fotoId && urls[celula.fotoId] ? (
                <img src={urls[celula.fotoId]} alt={foto?.nomeArquivo ?? 'Foto'} draggable={false} style={relativo(celula.foto, celula.celula)} />
              ) : null}
              {foto && dpi < projeto.dpi - 0.5 ? <span className="aviso-dpi">Baixa resolução</span> : null}
            </div>
          )
        })}
        {pagina.celulas.map((celula) => {
          if (!celula.legenda || !celula.textoLegenda) return null
          const fontePx = pxPorMm > 0 ? (projeto.fonteLegendaPt * 25.4 * pxPorMm) / 72 : 12
          const linhas =
            fontePronta
              ? linhasLegenda(celula.textoLegenda, Math.max(0, (celula.legenda.w - 3) * pxPorMm), fontePx)
              : [celula.textoLegenda]
          return (
            <div
              key={`legenda-${celula.slotIndex}`}
              className="legenda-folha"
              style={{
                ...posicao(celula.legenda, pagina),
                textAlign: projeto.alinhamentoLegenda === 'centro' ? 'center' : 'left',
                fontSize: `${fontePx}px`,
                padding: '0 1.5mm',
                boxSizing: 'border-box',
              }}
            >
              {linhas.map((linha, indice) => (
                <div key={`${celula.slotIndex}-${indice}`} style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {linha}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function useMiniaturas(pagina: PaginaLayout, projeto: Projeto, blobs: Map<string, Blob>) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const assinatura = pagina.celulas
    .flatMap((celula) => {
      if (!celula.fotoId) return []
      const foto = fotoDoSlot(projeto, celula.fotoId)
      return [
        `${celula.fotoId}:${celula.foto.w.toFixed(2)}:${celula.foto.h.toFixed(2)}:${foto ? JSON.stringify(foto.transformacao) : ''}:${projeto.encaixe}`,
      ]
    })
    .sort()
    .join('|')

  useEffect(() => {
    let cancelado = false
    const criadas: string[] = []
    void (async () => {
      const proximas: Record<string, string> = {}
      const vistas = new Set<string>()
      for (const celula of pagina.celulas) {
        if (!celula.fotoId || vistas.has(celula.fotoId) || celula.foto.w <= 0 || celula.foto.h <= 0) continue
        vistas.add(celula.fotoId)
        const foto = fotoDoSlot(projeto, celula.fotoId)
        const blob = blobs.get(celula.fotoId)
        if (!foto || !blob) continue
        const largura = Math.max(24, Math.round((celula.foto.w / pagina.larguraMm) * 1200))
        const altura = Math.max(24, Math.round((celula.foto.h / celula.foto.w) * largura))
        const canvas = await renderCelula(blob, foto.transformacao, largura, altura, projeto.encaixe)
        const arquivo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
        if (!arquivo) continue
        const url = URL.createObjectURL(arquivo)
        if (cancelado) {
          URL.revokeObjectURL(url)
          criadas.forEach((item) => URL.revokeObjectURL(item))
          return
        }
        criadas.push(url)
        proximas[celula.fotoId] = url
      }
      if (cancelado) {
        criadas.forEach((url) => URL.revokeObjectURL(url))
        return
      }
      setUrls((anteriores) => {
        Object.values(anteriores).forEach((url) => URL.revokeObjectURL(url))
        return proximas
      })
    })()
    return () => {
      cancelado = true
    }
  }, [assinatura, blobs])

  return urls
}

function linhasLegenda(texto: string, larguraPx: number, fontePx: number): string[] {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return [texto]
  ctx.font = `${fontePx}px ${FAMILIA_FONTE}, sans-serif`
  return wrapCaption(texto, larguraPx, (linha) => ctx.measureText(linha).width)
}

function posicao(caixa: { x: number; y: number; w: number; h: number }, pagina: PaginaLayout): CSSProperties {
  return {
    left: `${(caixa.x / pagina.larguraMm) * 100}%`,
    top: `${(caixa.y / pagina.alturaMm) * 100}%`,
    width: `${(caixa.w / pagina.larguraMm) * 100}%`,
    height: `${(caixa.h / pagina.alturaMm) * 100}%`,
  }
}

function relativo(
  interno: { x: number; y: number; w: number; h: number },
  externo: { x: number; y: number; w: number; h: number },
): CSSProperties {
  return {
    position: 'absolute',
    left: `${((interno.x - externo.x) / externo.w) * 100}%`,
    top: `${((interno.y - externo.y) / externo.h) * 100}%`,
    width: `${(interno.w / externo.w) * 100}%`,
    height: `${(interno.h / externo.h) * 100}%`,
  }
}
