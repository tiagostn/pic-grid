import { Button, Drawer, Group, Stack, Text } from '@mantine/core'
import { formatarData } from '../lib/texto'
import { useEstado } from '../estado'

export function GavetaProjetos() {
  const {
    projeto,
    projetos,
    gavetaAberta,
    setGavetaAberta,
    novoProjeto,
    abrirProjeto,
    apagarProjetoPorId,
    acimaDaCota,
    apagarExportados,
  } = useEstado()

  return (
    <Drawer opened={gavetaAberta} onClose={() => setGavetaAberta(false)} title="Projetos" position="right" size="md">
      <Stack gap="sm">
        <Button onClick={() => void novoProjeto()}>Novo projeto</Button>
        {acimaDaCota ? (
          <Button variant="light" color="orange" onClick={() => void apagarExportados()}>
            Apagar projetos já exportados
          </Button>
        ) : null}
        {projetos.length === 0 ? (
          <Text size="sm" c="dimmed">
            Nenhum projeto guardado ainda.
          </Text>
        ) : (
          projetos.map((item) => (
            <div key={item.id} className="linha-foto" style={item.id === projeto.id ? { borderColor: '#1c7ed6' } : undefined}>
              <Text fw={600}>{item.nome}</Text>
              <Text size="xs" c="dimmed">
                {formatarData(item.atualizadoEm)}
                {item.exportadoEm ? ` · exportado ${formatarData(item.exportadoEm)}` : ''}
              </Text>
              <Group gap={6}>
                <Button size="xs" variant="light" onClick={() => void abrirProjeto(item.id)}>
                  Abrir
                </Button>
                <Button
                  size="xs"
                  color="red"
                  variant="light"
                  onClick={() => {
                    if (window.confirm(`Apagar “${item.nome}”?`)) void apagarProjetoPorId(item.id)
                  }}
                >
                  Apagar
                </Button>
              </Group>
            </div>
          ))
        )}
      </Stack>
    </Drawer>
  )
}
