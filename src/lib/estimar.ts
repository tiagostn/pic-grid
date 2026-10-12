import type { PaginaLayout } from './layout'
import { mmParaPx } from './unidades'

export function estimarBytes(
  paginas: PaginaLayout[],
  dpi: number,
  qualidade: number,
  formato: 'pdf' | 'png' | 'jpeg',
): number {
  let pixels = 0
  for (const pagina of paginas) {
    if (formato === 'pdf') {
      for (const celula of pagina.celulas) {
        if (!celula.fotoId) continue
        pixels += mmParaPx(celula.foto.w, dpi) * mmParaPx(celula.foto.h, dpi)
      }
    } else {
      pixels += mmParaPx(pagina.larguraMm, dpi) * mmParaPx(pagina.alturaMm, dpi)
    }
  }
  const porPixel = formato === 'png' ? 0.8 : 0.15 * (qualidade / 0.85)
  return Math.round(pixels * porPixel) + paginas.length * 4000
}
