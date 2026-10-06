import { extractText, getDocumentProxy } from "unpdf";

/** Extrae el texto de un PDF. Si no tiene capa de texto (escaneado), devuelve vacío: requiere OCR, fuera de alcance. */
export async function textoDePdf(datos: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(datos);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
