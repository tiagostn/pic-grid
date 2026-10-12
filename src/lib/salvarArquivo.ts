export async function salvarArquivo(
  blob: Blob,
  nome: string,
  mime: string,
  extensao: string,
  descricao: string,
): Promise<void> {
  const picker = window.showSaveFilePicker
  if (typeof picker === 'function') {
    try {
      const alca = await picker({
        suggestedName: nome,
        types: [{ description: descricao, accept: { [mime]: [extensao] } }],
      })
      const gravador = await alca.createWritable()
      await gravador.write(blob)
      await gravador.close()
      return
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === 'AbortError') throw erro
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 15_000)
}
