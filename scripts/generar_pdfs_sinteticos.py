"""
Genera informes PDF SINTÉTICOS con formato de informe de diagnóstico por imágenes,
para probar la lectura de PDF y las validaciones. Ningún dato corresponde a pacientes reales.
Uso: python3 scripts/generar_pdfs_sinteticos.py <carpeta_salida>
"""
import csv, os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
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
  ("T-900001_mamografia.pdf", "T-900001", "GÓMEZ, Ana", "23.456.789", "23.456.789", "05/03/1970", "mamografia", "Mamografía bilateral", "M04",
   "Mamografía digital bilateral en proyecciones cráneo-caudal y medio-lateral oblicua.", MAMO_HALL_NORMAL, "Estudio mamográfico sin hallazgos. BI-RADS 1."),
  ("T-900002_mamografia.pdf", "T-900002", "SOSA, Laura", "27.111.222", "27.111.222", "12/08/1965", "mamografia", "Mamografía bilateral", "M04",
   "Mamografía digital bilateral en proyecciones cráneo-caudal y medio-lateral oblicua.",
   "Mamas de densidad tipo C. Nódulo de 14 mm de márgenes irregulares en cuadrante superoexterno de mama derecha.", "Estudio mamográfico sin hallazgos. BI-RADS 1."),
  ("T-900003_densitometria.pdf", "T-900003", "PÉREZ, Graciela", "14.987.654", "14.987.654", "22/11/1952", "densitometria", "Densitometría ósea", "M07",
   "Densitometría ósea por absorciometría dual de rayos X (DXA) de columna lumbar y cadera izquierda.",
   "Columna lumbar L1-L4: DMO 0,812 g/cm². T-score -2,8. Z-score -1,9. Cuello femoral izquierdo: DMO 0,690 g/cm². T-score -2,1.", "Osteopenia."),
  ("T-900004_ecografia_abdominal.pdf", "T-900004", "LÓPEZ, Carlos", "30.555.444", "30.555.443", "01/02/1980", "ecografia_abdominal", "Ecografía abdominal", "M11",
   "Ecografía abdominal con transductor convexo multifrecuencia, en ayunas.", ECO_ABD.format(via="xx", rd="Riñón derecho: sin medidas."),
   "Ecografía abdominal dentro de parámetros normales."),
  ("T-900005_ecografia_abdominal.pdf", "T-900005", "DÍAZ, Rosa", "18.222.333", "18.222.333", "09/09/1958", "ecografia_abdominal", "Ecografía abdominal", "M11",
   "Ecografía abdominal con transductor convexo multifrecuencia, en ayunas.", ECO_ABD.format(via="4", rd="Riñón derecho: ausente, antecedente de nefrectomía derecha."),
   "Ausencia de riñón derecho por nefrectomía. Resto del estudio sin alteraciones."),
  ("T-900006_radiografia_torax.pdf", "T-900006", "MEDINA, Jorge", "25.000.111", "25.100.111", "15/06/1975", "radiografia_torax", "Radiografía de tórax", "M15",
   "Radiografía de tórax en proyección frente, en bipedestación.",
   "Campos pulmonares sin infiltrados ni consolidaciones. Senos costofrénicos libres. Silueta cardíaca de tamaño normal con índice cardiotorácico de 0,46. Mediastino centrado.", ""),
]

def pdf(c):
    archivo, turno, paciente, dni, _, nac, _, estudio, medico, tecnica, hallazgos, conclusion = c
    doc = SimpleDocTemplate(os.path.join(OUT, archivo), pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=15*mm, bottomMargin=15*mm,
                            title=f"Informe {turno}", author="CDO (sintético)")
    els = []
    if os.environ.get("CON_LOGO", "1") == "1" and os.path.exists(LOGO):
        els.append(Image(LOGO, width=50*mm, height=50*mm*445/1256, hAlign="LEFT"))
    els.append(Spacer(1, 4*mm))
    t = Table([
        ["Paciente:", paciente, "Turno N°:", turno],
        ["DNI:", dni, "Fecha:", "06/10/2026"],
        ["Fecha de nacimiento:", nac, "Estudio:", estudio],
    ], colWidths=[38*mm, 52*mm, 22*mm, 58*mm])
    t.setStyle(TableStyle([("FONT", (0,0), (-1,-1), "Helvetica", 9), ("FONT", (0,0), (0,-1), "Helvetica-Bold", 9), ("FONT", (2,0), (2,-1), "Helvetica-Bold", 9),
                           ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#A9ABAE")), ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#F4F5EF"))]))
    els += [t, Spacer(1, 5*mm)]
    els += [Paragraph("TÉCNICA:", H), Paragraph(tecnica, P)]
    els += [Paragraph("HALLAZGOS:", H)] + [Paragraph(l, P) for l in hallazgos.split("\n")]
    els += [Paragraph("CONCLUSIÓN:", H), Paragraph(conclusion or " ", P)]
    els += [Spacer(1, 12*mm), Paragraph(f"Médico {medico[1:]} - M.P. {1000 + int(medico[1:])}", P), Paragraph("Informe sintético para pruebas. No corresponde a un paciente real.", ParagraphStyle("n", parent=P, fontSize=7, textColor=colors.grey))]
    doc.build(els)

for c in CASOS:
    pdf(c)
with open(os.path.join(OUT, "turnos.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["turno_id", "apellido_nombre", "dni", "fecha_nacimiento", "tipo_estudio", "medico_id"])
    for c in CASOS:
        w.writerow([c[1], c[2], c[4], c[5], c[6], c[8]])
print(f"{len(CASOS)} PDFs y turnos.csv en {OUT}")
