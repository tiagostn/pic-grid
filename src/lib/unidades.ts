export const MM_POR_POLEGADA = 25.4
export const PT_POR_POLEGADA = 72

export function mmParaPt(mm: number): number {
  return (mm * PT_POR_POLEGADA) / MM_POR_POLEGADA
}

export function mmParaPx(mm: number, dpi: number): number {
  return Math.max(0, Math.round((mm / MM_POR_POLEGADA) * dpi))
}

export function ptParaMm(pt: number): number {
  return (pt * MM_POR_POLEGADA) / PT_POR_POLEGADA
}
