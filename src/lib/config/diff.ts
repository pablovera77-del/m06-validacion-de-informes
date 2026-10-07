/** Diferencia por líneas entre dos textos (LCS). Sirve para revisar qué cambia en una versión de prompt antes de aprobarla. */
export type LineaDiff = { tipo: "igual" | "agregada" | "quitada"; texto: string };

export function diffLineas(antes: string, despues: string): LineaDiff[] {
  const a = antes.split("\n");
  const b = despues.split("\n");
  const n = a.length, m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: LineaDiff[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ tipo: "igual", texto: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ tipo: "quitada", texto: a[i++] });
    else out.push({ tipo: "agregada", texto: b[j++] });
  }
  while (i < n) out.push({ tipo: "quitada", texto: a[i++] });
  while (j < m) out.push({ tipo: "agregada", texto: b[j++] });
  return out;
}
