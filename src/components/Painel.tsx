import {
  Accordion,
  Alert,
  Button,
  Group,
  NumberInput,
  Progress,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { PRESETS, type Alinhamento, type Dpi, type Encaixe, type ModoLegenda, type Orientacao } from '../tipos'
import { estimarBytes } from '../lib/estimar'
import { formatarBytes } from '../lib/texto'
import { useEstado } from '../estado'
import { GavetaProjetos } from './GavetaProjetos'
import { ListaFotos } from './ListaFotos'

export function Painel() {
  const {
    projeto,
    paginas,
    atualizar,
    adicionarArquivos,
    legendasDosArquivos,
    exportar,
    salvarArquivoProjeto,
    abrirArquivoProjeto,
    exportando,
    progresso,
    erro,
    aviso,
    lendo,
    podeInstalar,
    instalar,
    imprimir,
    setGavetaAberta,
    apagarRascunhoAtual,
    acimaDaCota,
    bytes,
    setErro,
  } = useEstado()

  const estimativa = {
    pdf: estimarBytes(paginas, projeto.dpi, projeto.qualidadeJpeg, 'pdf'),
    png: estimarBytes(paginas, projeto.dpi, projeto.qualidadeJpeg, 'png'),
    jpeg: estimarBytes(paginas, projeto.dpi, projeto.qualidadeJpeg, 'jpeg'),
  }
  const invalida = paginas.some((pagina) => !pagina.valida)

  return (
    <aside className="controles">
      <Stack gap="sm">
        <div>
          <div className="marca">
            <img src="/favicon.svg" alt="" width={36} height={36} />
            <span className="marca-nome">pic-grid</span>
          </div>
          <Text size="sm">As fotos não saem deste computador.</Text>
        </div>
        {podeInstalar ? (
          <Button variant="light" onClick={() => void instalar()}>
            Instalar aplicativo
          </Button>
        ) : null}
        <Group gap="xs">
          <Button variant="default" onClick={() => setGavetaAberta(true)}>
            Projetos
          </Button>
          <Button variant="default" onClick={() => void salvarArquivoProjeto()}>
            Salvar arquivo
          </Button>
          <Button variant="default" onClick={() => document.getElementById('abrir-projeto')?.click()}>
            Abrir arquivo
          </Button>
          <Button variant="default" color="red" onClick={() => void apagarRascunhoAtual()}>
            Apagar rascunho
          </Button>
        </Group>
        <input
          id="abrir-projeto"
          type="file"
          accept=".picgrid,.zip,application/zip"
          hidden
          onChange={(evento) => {
            const arquivo = evento.currentTarget.files?.[0]
            evento.currentTarget.value = ''
            if (arquivo) void abrirArquivoProjeto(arquivo)
          }}
        />
        <TextInput label="Nome da folha" value={projeto.nome} onChange={(evento) => atualizar({ nome: evento.currentTarget.value })} />
        <Dropzone
          onDrop={(arquivos) => void adicionarArquivos(arquivos)}
          onReject={() => setErro('Algum arquivo foi recusado. Use JPEG, PNG, WebP ou HEIC de até 40 MB.')}
          accept={{
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/webp': ['.webp'],
            'image/heic': ['.heic'],
            'image/heif': ['.heif'],
          }}
          maxSize={40 * 1024 * 1024}
        >
          <Text size="sm" ta="center">
            Solte as fotos aqui ou clique para escolher
          </Text>
        </Dropzone>
        {lendo ? <Text size="sm">{lendo}</Text> : null}
        {erro ? (
          <Alert color="red" title="Algo falhou" withCloseButton onClose={() => setErro(null)}>
            {erro}
          </Alert>
        ) : null}
        {aviso ? <Alert color="yellow">{aviso}</Alert> : null}
        {acimaDaCota ? (
          <Alert color="orange" title="Rascunhos grandes">
            Os rascunhos passam de {formatarBytes(bytes)}. A exportação continua disponível. Em Projetos, apague folhas já exportadas.
          </Alert>
        ) : null}
        {invalida ? (
          <Alert color="red">A grade não cabe na folha. Reduza margens, espaçamento, fonte ou o número de células.</Alert>
        ) : null}

        <SegmentedControl
          fullWidth
          value={projeto.orientacao}
          onChange={(valor) => atualizar({ orientacao: valor as Orientacao })}
          data={[
            { label: 'Retrato', value: 'retrato' },
            { label: 'Paisagem', value: 'paisagem' },
          ]}
          aria-label="Orientação da folha"
        />
        <div>
          <Text size="sm" mb={6}>
            Grade
          </Text>
          <Group gap={6}>
            {PRESETS.map(([colunas, linhas]) => (
              <Button
                key={`${colunas}x${linhas}`}
                size="xs"
                variant={projeto.colunas === colunas && projeto.linhas === linhas ? 'filled' : 'light'}
                onClick={() => atualizar({ colunas, linhas })}
              >
                {colunas}×{linhas}
              </Button>
            ))}
          </Group>
        </div>
        <Group grow>
          <NumberInput
            label="Colunas"
            min={1}
            max={10}
            allowDecimal={false}
            value={projeto.colunas}
            onChange={(valor) => numero(valor, (colunas) => atualizar({ colunas }))}
          />
          <NumberInput
            label="Linhas"
            min={1}
            max={10}
            allowDecimal={false}
            value={projeto.linhas}
            onChange={(valor) => numero(valor, (linhas) => atualizar({ linhas }))}
          />
        </Group>
        <Group grow>
          <NumberInput
            label="Margem"
            min={0}
            max={50}
            suffix=" mm"
            value={projeto.margemMm}
            onChange={(valor) => numero(valor, (margemMm) => atualizar({ margemMm }))}
          />
          <NumberInput
            label="Espaço"
            min={0}
            max={30}
            suffix=" mm"
            value={projeto.espacoMm}
            onChange={(valor) => numero(valor, (espacoMm) => atualizar({ espacoMm }))}
          />
        </Group>
        <NumberInput
          label="Colunas por grupo"
          description="Fotos lado a lado em cada grupo. As que passarem descem para a linha de baixo, sem espaço entre essas linhas."
          min={1}
          max={10}
          allowDecimal={false}
          clampBehavior="strict"
          value={projeto.tamanhoGrupo}
          onChange={(valor) => numero(valor, (tamanhoGrupo) => atualizar({ tamanhoGrupo }))}
        />
        {projeto.modoLegenda === 'grupo' || projeto.tamanhoGrupo > 1 ? (
          <div>
            <Text size="sm" mb={6}>
              Legenda do grupo
            </Text>
            <SegmentedControl
              fullWidth
              value={projeto.modoLegenda}
              onChange={(valor) =>
                atualizar({
                  modoLegenda: valor as ModoLegenda,
                  legendasLigadas: valor === 'grupo' ? true : projeto.legendasLigadas,
                })
              }
              data={[
                { label: 'Em cada foto', value: 'individual' },
                { label: 'Uma por grupo', value: 'grupo' },
              ]}
            />
          </div>
        ) : null}
        <Switch
          label="Legendas"
          checked={projeto.legendasLigadas}
          onChange={(evento) => atualizar({ legendasLigadas: evento.currentTarget.checked })}
        />
        {projeto.legendasLigadas ? (
          <Group grow>
            <NumberInput
              label="Fonte"
              min={6}
              max={24}
              suffix=" pt"
              value={projeto.fonteLegendaPt}
              onChange={(valor) => numero(valor, (fonteLegendaPt) => atualizar({ fonteLegendaPt }))}
            />
            <div>
              <Text size="sm" mb={6}>
                Alinhamento
              </Text>
              <SegmentedControl
                value={projeto.alinhamentoLegenda}
                onChange={(valor) => atualizar({ alinhamentoLegenda: valor as Alinhamento })}
                data={[
                  { label: 'Centro', value: 'centro' },
                  { label: 'Esquerda', value: 'esquerda' },
                ]}
              />
            </div>
          </Group>
        ) : null}
        <Button variant="light" onClick={legendasDosArquivos}>
          Usar nome do arquivo
        </Button>

        <Accordion variant="contained">
          <Accordion.Item value="mais">
            <Accordion.Control>Mais opções</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                <div>
                  <Text size="sm" mb={6}>
                    Encaixe da foto
                  </Text>
                  <SegmentedControl
                    fullWidth
                    value={projeto.encaixe}
                    onChange={(valor) => atualizar({ encaixe: valor as Encaixe })}
                    data={[
                      { label: 'Preencher', value: 'cover' },
                      { label: 'Foto inteira', value: 'contain' },
                    ]}
                  />
                </div>
                <Switch
                  label="Guias de corte"
                  checked={projeto.guiasCorte}
                  onChange={(evento) => atualizar({ guiasCorte: evento.currentTarget.checked })}
                />
                <NumberInput
                  label="Moldura"
                  min={0}
                  max={20}
                  suffix=" mm"
                  value={projeto.bordaInternaMm}
                  onChange={(valor) => numero(valor, (bordaInternaMm) => atualizar({ bordaInternaMm }))}
                />
                <TextInput
                  label="Cabeçalho da folha"
                  value={projeto.cabecalho}
                  onChange={(evento) => atualizar({ cabecalho: evento.currentTarget.value })}
                />
                <div>
                  <Text size="sm" mb={6}>
                    DPI
                  </Text>
                  <SegmentedControl
                    fullWidth
                    value={String(projeto.dpi)}
                    onChange={(valor) => atualizar({ dpi: Number(valor) as Dpi })}
                    data={[
                      { label: '150', value: '150' },
                      { label: '200', value: '200' },
                      { label: '300', value: '300' },
                    ]}
                  />
                </div>
                <div>
                  <Text size="sm" mb={6}>
                    Qualidade JPEG {Math.round(projeto.qualidadeJpeg * 100)}%
                  </Text>
                  <Slider
                    min={0.7}
                    max={0.95}
                    step={0.05}
                    value={projeto.qualidadeJpeg}
                    onChange={(qualidadeJpeg) => atualizar({ qualidadeJpeg })}
                    aria-label="Qualidade JPEG"
                  />
                </div>
                <Button variant="default" onClick={imprimir}>
                  Imprimir
                </Button>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>

        <Text size="xs" c="dimmed">
          Estimativa: PDF {formatarBytes(estimativa.pdf)} · PNG {formatarBytes(estimativa.png)} · JPEG{' '}
          {formatarBytes(estimativa.jpeg)}
        </Text>
        <Stack gap={6}>
          <Button fullWidth disabled={exportando || invalida} onClick={() => void exportar('pdf')}>
            Exportar PDF
          </Button>
          <Button fullWidth disabled={exportando || invalida} variant="light" onClick={() => void exportar('png')}>
            Exportar PNG
          </Button>
          <Button fullWidth disabled={exportando || invalida} variant="light" onClick={() => void exportar('jpeg')}>
            Exportar JPEG
          </Button>
          <Button fullWidth disabled={exportando || invalida} variant="light" onClick={() => void exportar('docx')}>
            Exportar DOCX
          </Button>
        </Stack>
        {progresso ? (
          <div>
            <Text size="sm" mb={4}>
              Página {progresso.atual} de {progresso.total}
            </Text>
            <Progress value={progresso.total === 0 ? 0 : (progresso.atual / progresso.total) * 100} />
          </div>
        ) : null}
        <Text size="xs" c="dimmed">
          Delete remove a foto · setas movem a seleção · Ctrl+Enter exporta
        </Text>
        <Text fw={600}>Fotos</Text>
        <ListaFotos />
      </Stack>
      <GavetaProjetos />
    </aside>
  )
}

function numero(valor: number | string, aplicar: (n: number) => void) {
  if (typeof valor === 'string' && valor.trim() === '') return
  const n = typeof valor === 'number' ? valor : Number(valor)
  if (Number.isFinite(n)) aplicar(n)
}
