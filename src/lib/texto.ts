export function nomeExportacao(extensao: string, data = new Date()): string {
  const dois = (valor: number) => String(valor).padStart(2, '0')
  const carimbo = `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}-${dois(data.getHours())}${dois(data.getMinutes())}`
  return `pic-grid-${carimbo}.${extensao}`
}

export function formatarBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

export function formatarData(ms: number): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(ms)
}
