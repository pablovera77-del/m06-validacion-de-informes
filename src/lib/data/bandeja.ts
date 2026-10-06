import { CASOS_PRUEBA, type CasoPrueba } from "./casos-prueba";

/** Informes de demostración para la vista del médico: una selección del set de prueba que cubre todos los casos. */
const IDS_DEMO = [
  "CA01-012", "CA01-001", "CA03-028", "CA04-033", "CA04-036", "CA07-042", "CA08-050",
  "CA08-052", "CA02-025", "CA02-027", "CA01-019", "CA04-038", "CA07-045", "CA08-054",
];

export function bandejaMedico(): CasoPrueba[] {
  const sel = IDS_DEMO.map((id) => CASOS_PRUEBA.find((c) => c.id === id)).filter((c): c is CasoPrueba => !!c);
  return sel.length >= 8 ? sel : CASOS_PRUEBA.slice(0, 15);
}

export function casoPorInforme(informeId: string): CasoPrueba | undefined {
  return CASOS_PRUEBA.find((c) => c.informe.id === informeId);
}
