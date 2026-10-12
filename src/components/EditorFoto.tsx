import { useEffect, useRef, useState } from 'react'
import { Button, Group, Modal, SegmentedControl, Slider, Switch, Text } from '@mantine/core'
import Cropper, { type Area } from 'react-easy-crop'
import { midiaDoEditor } from '../lib/imagens'
import { useEstado } from '../estado'
import type { Crop, Rotacao90, Transformacao } from '../tipos'

type Snap = {
  rotacao: Rotacao90
  espelho: boolean
  livre: boolean
  aspectoLivre: number
  crop: { x: number; y: number }
  zoom: number
  area: Area | null
}

export function EditorFoto() {
  const { projeto, blobs, editorId, paginas, fecharEditor, aplicarTransformacao } = useEstado()
  const foto = projeto.fotos.find((item) => item.id === editorId)
  const blob = editorId ? blobs.get(editorId) : undefined
  const celula = paginas.flatMap((pagina) => pagina.celulas).find((item) => item.fotoId === editorId)
  if (!foto || !blob) return null
  const aspectoCelula = celula && celula.foto.h > 0 ? celula.foto.w / celula.foto.h : 1

  return (
    <Modal opened onClose={fecharEditor} title={`Editar ${foto.nomeArquivo}`} size="xl" centered>
      <EditorConteudo
        key={foto.id}
        blob={blob}
        transformacao={foto.transformacao}
        aspectoCelula={aspectoCelula}
        onCancel={fecharEditor}
        onApply={(transformacao) => aplicarTransformacao(foto.id, transformacao)}
      />
    </Modal>
  )
}

function EditorConteudo({
  blob,
  transformacao,
  aspectoCelula,
  onCancel,
  onApply,
}: {
  blob: Blob
  transformacao: Transformacao
  aspectoCelula: number
  onCancel: () => void
  onApply: (transformacao: Transformacao) => void
}) {
  const [rotacao, setRotacao] = useState<Rotacao90>(transformacao.rotacao90)
  const [espelho, setEspelho] = useState(transformacao.espelhoHorizontal)
  const [livre, setLivre] = useState(false)
  const [aspectoLivre, setAspectoLivre] = useState(1)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [grade, setGrade] = useState(true)
  const [chave, setChave] = useState(0)
  const [inicial, setInicial] = useState<Area | undefined>(undefined)
  const [midia, setMidia] = useState<{ url: string; largura: number; altura: number; rotacao: Rotacao90; espelho: boolean } | null>(null)
  const [passado, setPassado] = useState<Snap[]>([])
  const [futuro, setFuturo] = useState<Snap[]>([])
  const sliderAtivo = useRef(false)
  const aplicouInicial = useRef(false)
  const snapRef = useRef<Snap>(capturar(rotacao, espelho, livre, aspectoLivre, crop, zoom, area))
  snapRef.current = capturar(rotacao, espelho, livre, aspectoLivre, crop, zoom, area)

  useEffect(() => {
    let cancelado = false
    void midiaDoEditor(blob, rotacao, espelho).then((gerada) => {
      if (cancelado) {
        URL.revokeObjectURL(gerada.url)
        return
      }
      if (!aplicouInicial.current && rotacao === transformacao.rotacao90 && espelho === transformacao.espelhoHorizontal) {
        aplicouInicial.current = true
        const pixels = pixelsIniciais(transformacao, gerada.largura, gerada.altura)
        if (pixels) {
          setInicial(pixels)
          setChave((valor) => valor + 1)
        }
      }
      setMidia((atual) => {
        if (atual) URL.revokeObjectURL(atual.url)
        return { ...gerada, rotacao, espelho }
      })
    })
    return () => {
      cancelado = true
    }
  }, [blob, rotacao, espelho])

  useEffect(() => {
    return () => {
      setMidia((atual) => {
        if (atual) URL.revokeObjectURL(atual.url)
        return null
      })
    }
  }, [])

  useEffect(() => {
    const aoTecla = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key === 'Enter') {
        evento.preventDefault()
        evento.stopPropagation()
        aplicar()
      }
    }
    window.addEventListener('keydown', aoTecla, true)
    return () => window.removeEventListener('keydown', aoTecla, true)
  })

  const aspecto = livre ? aspectoLivre : aspectoCelula
  const pronta = midia != null && midia.rotacao === rotacao && midia.espelho === espelho

  function guardar() {
    setPassado((atual) => [...atual.slice(-29), snapRef.current])
    setFuturo([])
  }

  function aplicarSnap(snap: Snap) {
    setRotacao(snap.rotacao)
    setEspelho(snap.espelho)
    setLivre(snap.livre)
    setAspectoLivre(snap.aspectoLivre)
    setCrop(snap.crop)
    setZoom(snap.zoom)
    setArea(snap.area)
    setInicial(snap.area ?? undefined)
    setChave((valor) => valor + 1)
  }

  function desfazer() {
    const anterior = passado[passado.length - 1]
    if (!anterior) return
    setFuturo((atual) => [snapRef.current, ...atual])
    setPassado((atual) => atual.slice(0, -1))
    aplicarSnap(anterior)
  }

  function refazer() {
    const proximo = futuro[0]
    if (!proximo) return
    setPassado((atual) => [...atual, snapRef.current])
    setFuturo((atual) => atual.slice(1))
    aplicarSnap(proximo)
  }

  function girar(delta: number) {
    guardar()
    setRotacao((atual) => (((atual + delta) % 4) + 4) % 4 as Rotacao90)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setArea(null)
    setInicial(undefined)
    setChave((valor) => valor + 1)
  }

  function restaurar() {
    guardar()
    setRotacao(0)
    setEspelho(false)
    setLivre(false)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setArea(null)
    setInicial(undefined)
    setChave((valor) => valor + 1)
  }

  function aplicar() {
    if (!midia || !area) return
    onApply({
      rotacao90: rotacao,
      espelhoHorizontal: espelho,
      crop: normalizarCrop(area, midia.largura, midia.altura),
    })
  }

  return (
    <div>
      <div className="editor-quadro">
        {pronta && midia ? (
          <Cropper
            key={`${chave}-${rotacao}-${espelho}-${livre ? 'livre' : 'celula'}`}
            image={midia.url}
            crop={crop}
            zoom={zoom}
            rotation={0}
            aspect={Math.max(0.2, aspecto)}
            minZoom={1}
            maxZoom={4}
            cropShape="rect"
            showGrid={grade}
            zoomSpeed={0.12}
            zoomWithScroll
            restrictPosition
            keyboardStep={8}
            style={{}}
            classes={{}}
            mediaProps={{ alt: 'Foto em edição' }}
            cropperProps={{}}
            initialCroppedAreaPixels={inicial}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            onInteractionStart={guardar}
          />
        ) : (
          <Text c="white" p="md">
            Preparando imagem…
          </Text>
        )}
      </div>
      <Group mt="md" align="end">
        <div style={{ flex: 1, minWidth: 180 }}>
          <Text size="sm" mb={4}>
            Zoom
          </Text>
          <Slider
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(valor) => {
              if (!sliderAtivo.current) {
                sliderAtivo.current = true
                guardar()
              }
              setZoom(valor)
            }}
            onChangeEnd={() => {
              sliderAtivo.current = false
            }}
            aria-label="Zoom"
          />
        </div>
      </Group>
      <Group mt="md" gap="xs">
        <SegmentedControl
          value={livre ? 'livre' : 'celula'}
          onChange={(valor) => {
            guardar()
            const proximoLivre = valor === 'livre'
            setLivre(proximoLivre)
            if (proximoLivre && midia) setAspectoLivre(midia.largura / midia.altura)
            setChave((item) => item + 1)
            setArea(null)
            setInicial(undefined)
          }}
          data={[
            { label: 'Proporção da célula', value: 'celula' },
            { label: 'Proporção livre', value: 'livre' },
          ]}
        />
        <Switch label="Grade de terços" checked={grade} onChange={(evento) => setGrade(evento.currentTarget.checked)} />
      </Group>
      {livre ? (
        <div style={{ marginTop: 12 }}>
          <Text size="sm" mb={4}>
            Proporção {aspectoLivre.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          </Text>
          <Slider
            min={0.3}
            max={3}
            step={0.01}
            value={aspectoLivre}
            onChange={setAspectoLivre}
            aria-label="Proporção livre"
          />
        </div>
      ) : null}
      <Group mt="md" gap="xs">
        <Button variant="light" onClick={() => girar(1)}>
          Girar 90° horário
        </Button>
        <Button variant="light" onClick={() => girar(-1)}>
          Girar 90° anti-horário
        </Button>
        <Button
          variant="light"
          onClick={() => {
            guardar()
            setEspelho((atual) => !atual)
            setCrop({ x: 0, y: 0 })
            setZoom(1)
            setArea(null)
            setInicial(undefined)
            setChave((valor) => valor + 1)
          }}
        >
          Espelhar
        </Button>
        <Button variant="light" onClick={restaurar}>
          Restaurar original
        </Button>
        <Button variant="default" onClick={desfazer} disabled={passado.length === 0}>
          Desfazer
        </Button>
        <Button variant="default" onClick={refazer} disabled={futuro.length === 0}>
          Refazer
        </Button>
      </Group>
      <Group mt="lg" justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={aplicar} disabled={!area}>
          Aplicar
        </Button>
      </Group>
    </div>
  )
}

function capturar(
  rotacao: Rotacao90,
  espelho: boolean,
  livre: boolean,
  aspectoLivre: number,
  crop: { x: number; y: number },
  zoom: number,
  area: Area | null,
): Snap {
  return { rotacao, espelho, livre, aspectoLivre, crop: { ...crop }, zoom, area: area ? { ...area } : null }
}

function pixelsIniciais(transformacao: Transformacao, largura: number, altura: number): Area | undefined {
  const { crop } = transformacao
  const cheio = crop.x <= 0.001 && crop.y <= 0.001 && crop.largura >= 0.999 && crop.altura >= 0.999
  if (cheio) return undefined
  return {
    x: crop.x * largura,
    y: crop.y * altura,
    width: crop.largura * largura,
    height: crop.altura * altura,
  }
}

function normalizarCrop(area: Area, largura: number, altura: number): Crop {
  const x = limitar(area.x / largura)
  const y = limitar(area.y / altura)
  return {
    x,
    y,
    largura: Math.min(limitar(area.width / largura), 1 - x) || 0.01,
    altura: Math.min(limitar(area.height / altura), 1 - y) || 0.01,
  }
}

function limitar(valor: number): number {
  if (!Number.isFinite(valor)) return 0
  return Math.min(1, Math.max(0, valor))
}
