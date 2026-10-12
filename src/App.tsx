import { ProvedorProjeto, useEstado } from './estado'
import { EditorFoto } from './components/EditorFoto'
import { Painel } from './components/Painel'
import { Previa } from './components/Previa'

export default function App() {
  return (
    <ProvedorProjeto>
      <Tela />
    </ProvedorProjeto>
  )
}

function Tela() {
  const { hidratado, editorId, arrastando } = useEstado()
  if (!hidratado) {
    return (
      <main className="controles">
        <p>Abrindo o rascunho…</p>
      </main>
    )
  }
  return (
    <div className="app">
      <Painel />
      <Previa />
      {editorId ? <EditorFoto /> : null}
      {arrastando ? <div className="soltar">Solte as fotos</div> : null}
    </div>
  )
}
