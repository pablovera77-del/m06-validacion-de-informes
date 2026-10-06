"""
Genera informes PDF SINTÉTICOS con formato de informe de diagnóstico por imágenes,
para probar la lectura de PDF y las validaciones. Ningún dato corresponde a pacientes reales.
Uso: python3 scripts/generar_pdfs_sinteticos.py <carpeta_salida>
"""
import csv, os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.graphics.shapes import Drawing, PolyLine
from reportlab.lib import colors
from reportlab.lib.units import mm

OUT = sys.argv[1] if len(sys.argv) > 1 else "pdfs"
LOGO = os.path.join(os.path.dirname(__file__), "..", "public", "brand", "cdo-logo.png")
os.makedirs(OUT, exist_ok=True)
st = getSampleStyleSheet()
H = ParagraphStyle("h", parent=st["Heading4"], textColor=colors.HexColor("#5E6638"), spaceBefore=8, spaceAfter=2)
P = ParagraphStyle("p", parent=st["BodyText"], fontSize=10, leading=14)

MAMO_HALL_NORMAL = "Mamas de densidad tipo B (densidades fibroglandulares dispersas). Piel y complejo areola-pezón sin alteraciones. Regiones axilares sin adenomegalias. No se observan nódulos, distorsiones de la arquitectura ni microcalcificaciones sospechosas."
ECO_ABD = """HÍGADO: De tamaño normal, ecoestructura homogénea, sin lesiones focales. Lóbulo derecho de 138 mm.
VÍA BILIAR: La vía biliar intrahepática y el hepatocolédoco se observan de calibre normal midiendo {via} mm.
VESÍCULA BILIAR: De forma ovoidea, pared conservada de 2 mm de espesor. De contenido líquido homogéneo, alitiásica.
PÁNCREAS: Visualizado en cabeza y cuerpo, sin alteraciones.
BAZO: Homogéneo, de 102 mm.
RIÑÓN DERECHO E IZQUIERDO: Sin alteraciones morfológicas de significación.
{rd}
Riñón izquierdo: diámetro longitudinal 109 mm.
Aorta abdominal de trayecto y calibre conservado."""

CASOS = [
  # archivo, turno, paciente, dni_informe, dni_turno, nac, estudio_codigo, estudio_texto, medico, tecnica, hallazgos, conclusion
  ("90000001.pdf", "90000001", "GOMEZ ANA BEATRIZ", "23.456.789", "23.456.789", "05/03/1970", "mamografia", "MG MAMOGRAFIA BILATERAL", "M04",
   "Mamografía digital bilateral en proyecciones cráneo-caudal y medio-lateral oblicua.", MAMO_HALL_NORMAL, "Estudio mamográfico sin hallazgos. BI-RADS 1."),
  ("90000002.pdf", "90000002", "SOSA LAURA INES", "27.111.222", "27.111.222", "12/08/1965", "mamografia", "MG MAMOGRAFIA BILATERAL", "M04",
   "Mamografía digital bilateral en proyecciones cráneo-caudal y medio-lateral oblicua.",
   "Mamas de densidad tipo C. Nódulo de 14 mm de márgenes irregulares en cuadrante superoexterno de mama derecha.", "Estudio mamográfico sin hallazgos. BI-RADS 1."),
  ("90000003.pdf", "90000003", "PEREZ GRACIELA", "14.987.654", "14.987.654", "22/11/1952", "densitometria", "DO DENSITOMETRIA OSEA", "M07",
   "Densitometría ósea por absorciometría dual de rayos X (DXA) de columna lumbar y cadera izquierda.",
   "Columna lumbar L1-L4: DMO 0,812 g/cm². T-score -2,8. Z-score -1,9. Cuello femoral izquierdo: DMO 0,690 g/cm². T-score -2,1.", "Osteopenia."),
  ("90000004.pdf", "90000004", "LOPEZ CARLOS ALBERTO", "30.555.444", "30.555.443", "01/02/1980", "ecografia_abdominal", "US ECOGRAFIA COMPLETA DE ABDOMEN", "M11",
   "Ecografía abdominal con transductor convexo multifrecuencia, en ayunas.", ECO_ABD.format(via="xx", rd="Riñón derecho: sin medidas."),
   "Ecografía abdominal dentro de parámetros normales."),
  ("90000005.pdf", "90000005", "DIAZ ROSA", "18.222.333", "18.222.333", "09/09/1958", "ecografia_abdominal", "US ECOGRAFIA COMPLETA DE ABDOMEN", "M11",
   "Ecografía abdominal con transductor convexo multifrecuencia, en ayunas.", ECO_ABD.format(via="4", rd="Riñón derecho: ausente, antecedente de nefrectomía derecha."),
   "Ausencia de riñón derecho por nefrectomía. Resto del estudio sin alteraciones."),
  ("90000006.pdf", "90000006", "MEDINA JORGE", "25.000.111", "25.100.111", "15/06/1975", "radiografia_torax", "RX TORAX FRENTE", "M15",
   "Radiografía de tórax en proyección frente, en bipedestación.",
   "Campos pulmonares sin infiltrados ni consolidaciones. Senos costofrénicos libres. Silueta cardíaca de tamaño normal con índice cardiotorácico de 0,46. Mediastino centrado.", ""),
]

DIRECCION = "Av. Córdoba 262 (e) - San Juan - 4933218 - 2644987649"

def pie(canvas, doc):
    canvas.saveState()
    canvas.setFont("Times-Roman", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawCentredString(A4[0] / 2, 12 * mm, DIRECCION)
    canvas.restoreState()

def firma():
    # La firma real es una imagen: se dibuja como trazo (sin texto) para replicar ese caso.
    d = Drawing(60 * mm, 18 * mm)
    d.add(PolyLine([0, 20, 20, 40, 35, 10, 55, 35, 75, 15, 100, 30, 140, 25], strokeColor=colors.black, strokeWidth=1.2))
    return d

def pdf(c):
    archivo, turno, paciente, dni, _, nac, _, estudio, medico, tecnica, hallazgos, conclusion = c
    doc = SimpleDocTemplate(os.path.join(OUT, archivo), pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=15*mm, bottomMargin=20*mm,
                            title=f"Informe {turno}", author="CDO (sintético)")
    els = []
    if os.environ.get("CON_LOGO", "1") == "1" and os.path.exists(LOGO):
        els.append(Image(LOGO, width=50*mm, height=50*mm*445/1256, hAlign="LEFT"))
    t = Table([
        ["Nombre del Paciente:", paciente, "", ""],
        ["Fecha Nacimiento:", nac, "Cédula/ID:", dni.replace(".", "")],
        ["Fecha del Estudio:", "29/09/2026", "Estudio ID:", turno],
        ["Referido Por:", "DERIVANTE FICTICIO", "", ""],
        ["Descripción Estudio:", estudio, "", ""],
    ], colWidths=[38*mm, 62*mm, 24*mm, 46*mm])
    t.setStyle(TableStyle([("FONT", (0,0), (-1,-1), "Helvetica", 10), ("FONT", (1,0), (1,0), "Helvetica-Bold", 11), ("BOX", (0,0), (-1,-1), 0.8, colors.black)]))
    els += [t, Spacer(1, 12*mm)]
    B = lambda titulo, texto: Paragraph(f"<b>{titulo}</b> {texto}", P)
    els += [B("PROCEDIMIENTO:", tecnica), Spacer(1, 3*mm), Paragraph("<b>INFORME</b>", P), Spacer(1, 2*mm)]
    for l in hallazgos.split("\n"):
        if ":" in l and l.split(":")[0].isupper():
            k, v = l.split(":", 1)
            els += [B(k + ":", v), Spacer(1, 2*mm)]
        else:
            els += [Paragraph(l, P), Spacer(1, 2*mm)]
    if conclusion:
        els += [Paragraph("<b>CONCLUSIÓN:</b>", P), Paragraph(conclusion.upper(), P)]
    els += [PageBreak(), Paragraph("Atte.", P), Spacer(1, 10*mm), firma(),
            Paragraph("Informe sintético para pruebas. No corresponde a un paciente real.", ParagraphStyle("n", parent=P, fontSize=7, textColor=colors.grey))]
    doc.build(els, onFirstPage=pie, onLaterPages=pie)

for c in CASOS:
    pdf(c)
with open(os.path.join(OUT, "turnos.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["turno_id", "apellido_nombre", "dni", "fecha_nacimiento", "tipo_estudio", "medico_id"])
    for c in CASOS:
        w.writerow([c[1], c[2], c[4], c[5], c[6], c[8]])
print(f"{len(CASOS)} PDFs y turnos.csv en {OUT}")
