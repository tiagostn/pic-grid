import { useRef } from 'react'
import { Button, Group, NumberInput, Text, TextInput } from '@mantine/core'
import { gruposEfetivos } from '../lib/layout'
import { lerArraste } from '../lib/grupos'
import { useEstado } from '../estado'

export function ListaFotos() {
  const {
    projeto,
    selecionado,
    selecionar,
    abrirEditor,
    removerFoto,
    duplicarFoto,
    definirLegenda,
    definirLegendaGrupo,
    definirTamanhoDoGrupo,
    moverSlot,
    anexarFoto,
    moverGrupo,
    adicionarArquivos,
  } = useEstado()
  const arquivoGrupo = useRef<HTMLInputElement>(null)
  const destinoArquivo = useRef<string | null>(null)
  const grupos = gruposEfetivos(projeto)
  if (grupos.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nenhuma foto ainda.
      </Text>
    )
  }

  const modoGrupo = projeto.modoLegenda === 'grupo'
  let cursor = 0

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <input
        ref={arquivoGrupo}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
        multiple
        hidden
        onChange={(evento) => {
          const arquivos = [...(evento.currentTarget.files ?? [])]
          const grupoId = destinoArquivo.current
          evento.currentTarget.value = ''
          destinoArquivo.current = null
          if (arquivos.length && grupoId) void adicionarArquivos(arquivos, grupoId)
        }}
      />
      {grupos.map((grupo) => {
        const inicio = cursor
        cursor += grupo.slots.length
        return (
          <section
            key={grupo.id}
            className="grupo-lista"
            onDragOver={(evento) => {
              evento.preventDefault()
            }}
            onDrop={(evento) => {
              evento.preventDefault()
              const arquivos = [...evento.dataTransfer.files]
              if (arquivos.length) {
                void adicionarArquivos(arquivos, grupo.id)
                return
              }
              const dados = lerArraste(evento.dataTransfer.getData('text/plain'))
              if (dados?.tipo === 'foto') anexarFoto(Number(dados.id), grupo.id)
              if (dados?.tipo === 'grupo') moverGrupo(dados.id, grupo.id)
            }}
          >
            <div className="grupo-cabeca">
              <button
                type="button"
                className="alca-lista"
                draggable
                onDragStart={(evento) => {
                  evento.stopPropagation()
                  evento.dataTransfer.setData('text/plain', `grupo:${grupo.id}`)
                  evento.dataTransfer.effectAllowed = 'move'
                }}
              >
                Mover grupo
              </button>
              <NumberInput
                label="Colunas"
                size="xs"
                min={1}
                max={10}
                allowDecimal={false}
                clampBehavior="strict"
                value={grupo.colunas}
                onChange={(valor) => {
                  const n = typeof valor === 'number' ? valor : Number(valor)
                  if (Number.isFinite(n) && n >= 1) definirTamanhoDoGrupo(grupo.id, n)
                }}
                w={88}
              />
              <Button
                size="xs"
                variant="light"
                onClick={() => {
                  destinoArquivo.current = grupo.id
                  arquivoGrupo.current?.click()
                }}
              >
                Incluir fotos
              </Button>
            </div>
            {modoGrupo ? (
              <TextInput
                label="Legenda do grupo"
                size="xs"
                value={grupo.legenda}
                onChange={(evento) => definirLegendaGrupo(grupo.id, evento.currentTarget.value)}
              />
            ) : null}
            {grupo.slots.map((id, indice) => {
              const foto = id ? projeto.fotos.find((item) => item.id === id) : null
              const slot = inicio + indice
              return (
                <div
                  key={`${grupo.id}-${indice}`}
                  className={`linha-foto${selecionado === slot ? ' selecionada' : ''}`}
                  onDragOver={(evento) => {
                    evento.preventDefault()
                    evento.stopPropagation()
                  }}
                  onDrop={(evento) => {
                    evento.preventDefault()
                    evento.stopPropagation()
                    const arquivos = [...evento.dataTransfer.files]
                    if (arquivos.length) {
                      void adicionarArquivos(arquivos, grupo.id)
                      return
                    }
                    const dados = lerArraste(evento.dataTransfer.getData('text/plain'))
                    if (dados?.tipo === 'foto') moverSlot(Number(dados.id), slot)
                    if (dados?.tipo === 'grupo') moverGrupo(dados.id, grupo.id)
                  }}
                  onClick={() => selecionar(slot)}
                >
                  {foto ? (
                    <>
                      <Text
                        size="sm"
                        fw={600}
                        draggable
                        onDragStart={(evento) => {
                          evento.stopPropagation()
                          evento.dataTransfer.setData('text/plain', `foto:${slot}`)
                          evento.dataTransfer.effectAllowed = 'move'
                        }}
                        style={{ cursor: 'grab' }}
                      >
                        {foto.nomeArquivo}
                      </Text>
                      {modoGrupo ? null : (
                        <TextInput
                          label="Legenda"
                          size="xs"
                          value={foto.legenda}
                          onChange={(evento) => definirLegenda(foto.id, evento.currentTarget.value)}
                          onClick={(evento) => evento.stopPropagation()}
                        />
                      )}
                      <Group gap={6}>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={(evento) => {
                            evento.stopPropagation()
                            abrirEditor(foto.id)
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={(evento) => {
                            evento.stopPropagation()
                            duplicarFoto(foto.id)
                          }}
                        >
                          Duplicar
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          onClick={(evento) => {
                            evento.stopPropagation()
                            removerFoto(foto.id)
                          }}
                        >
                          Remover
                        </Button>
                      </Group>
                    </>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Espaço vazio
                    </Text>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
