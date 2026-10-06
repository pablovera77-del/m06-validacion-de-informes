# M06 · Validación de Informes Médicos

CDO Suite Digital · SAJUMED SRL — CDO Centro de Diagnóstico Dr. Orellano.

Control de calidad documental de informes **antes de la firma**. El sistema lee el informe, alerta posibles errores y registra la decisión del médico. **Nunca bloquea la firma ni modifica el informe.**

## Validaciones

| Código | Validación | Tipo |
|---|---|---|
| V1 | Campos obligatorios según tipo de estudio | Regla |
| V2 | Contenido duplicado (últimos 10 informes del mismo médico y estudio) | Regla |
| V3A | Consistencia BI-RADS / hallazgos | IA (con simulador local) |
| V3B | Consistencia T-score / conclusión en densitometría | Regla |
| V4 | Identidad del paciente contra el turno | Regla (sin IA) |
| V5 | Órgano ausente y medidas incompletas | Regla + IA |

## Estructura

```
src/lib/domain      tipos y normalización
src/lib/config      reglas y prompts versionados (HU18, HU28)
src/lib/engine      motor de validación V1–V5, proveedor de IA, set de prueba
src/lib/audit       log de auditoría con cadena de hash (HU9, HU22)
src/lib/data        datos sintéticos y set de prueba CA01–CA08
src/lib/metrics     indicadores del Panel de Calidad
src/app             vistas: médico, calidad, pruebas, configuración, auditoría, API
```

## Comandos

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # set de prueba CA01–CA08 + pruebas unitarias
npm run build
```

## Variables de entorno (Vercel)

| Variable | Uso |
|---|---|
| `M06_LLM_PROVIDER` | `gateway` para usar el modelo real vía Vercel AI Gateway. Sin definir: simulador local. |
| `M06_LLM_MODEL` | Modelo, por ejemplo `anthropic/claude-sonnet-5.5`. |
| `M06_API_TOKEN` | Token de servicio para `POST /api/validar` (etapa 2). |

## Privacidad

- Etapa 1 con datos **sintéticos**. Ningún dato corresponde a pacientes reales.
- Nombre, DNI y fecha de nacimiento nunca se envían a un modelo de IA: solo las secciones clínicas declaradas en cada prompt.
- Leyes 25.326 y 26.529. Marco de calidad: ISO 9001:2015.
