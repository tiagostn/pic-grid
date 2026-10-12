const RETICENCIAS = '…'

export function textoSemEmoji(texto: string): { texto: string; removeu: boolean } {
  const limpo = texto.replace(/\p{Extended_Pictographic}/gu, '').replace(/\uFE0F/g, '')
  return { texto: limpo, removeu: limpo !== texto }
}

export function temEmoji(texto: string): boolean {
  return textoSemEmoji(texto).removeu
}

export function ellipsize(texto: string, larguraMax: number, medir: (s: string) => number): string {
  if (medir(texto) <= larguraMax) return texto
  let s = texto
  while (s.length > 0 && medir(s + RETICENCIAS) > larguraMax) s = s.slice(0, -1)
  return `${s}${RETICENCIAS}`
}

export function wrapCaption(texto: string, larguraMax: number, medir: (s: string) => number): string[] {
  const limpo = textoSemEmoji(texto).texto.replace(/\s+/g, ' ').trim()
  if (!limpo || larguraMax <= 0) return []
  const palavras = limpo.split(' ')
  const linhas: string[] = []
  let indice = 0

  while (indice < palavras.length && linhas.length < 2) {
    let linha = ''
    while (indice < palavras.length) {
      const proxima = linha ? `${linha} ${palavras[indice]}` : palavras[indice]
      if (medir(proxima) <= larguraMax) {
        linha = proxima
        indice += 1
      } else {
        break
      }
    }

    if (!linha) {
      linhas.push(ellipsize(palavras[indice] ?? '', larguraMax, medir))
      break
    }

    if (linhas.length === 1 && indice < palavras.length) {
      linhas.push(ellipsize(`${linha} ${palavras[indice]}`, larguraMax, medir))
      break
    }

    linhas.push(linha)
  }

  return linhas
}
