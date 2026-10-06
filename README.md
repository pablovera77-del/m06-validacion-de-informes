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
| `M06_LLM_PROVIDER` | `anthropic` (API de Anthropic con la clave de CDO) o `gateway` (Vercel AI Gateway). Sin definir: simulador local. |
| `ANTHROPIC_API_KEY` | Clave de la API de Anthropic, con `M06_LLM_PROVIDER=anthropic`. Solo servidor. |
| `M06_LLM_MODEL` | Opcional. Por defecto `claude-sonnet-5-5` (Anthropic) o `anthropic/claude-sonnet-5.5` (gateway). |
| `M06_API_TOKEN` | Token de servicio para `POST /api/validar` (etapa 2). |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Base de datos propia (proyecto «M06 - Validacion de Informes», São Paulo; tablas `m06_` con RLS y sin acceso anónimo). Solo servidor. |
| `SUPABASE_PUBLISHABLE_KEY` | Login con Supabase Auth. Con base de datos configurada, el login es obligatorio. |
| `GOOGLE_SERVICE_ACCOUNT_JSON`, `M06_DRIVE_CARPETA_INFORMES`, `M06_DRIVE_PLANILLA_TURNOS` | Lectura de PDF y turnos desde Google Drive (solo lectura). |

Ver `.env.example`. El esquema de base de datos está en `supabase/migrations/`.

## Usuarios y roles (HU26)

| Rol | Accede a |
|---|---|
| Médico informante | Solo sus informes (por código de médico): revisión de alertas, override, firma. |
| Calidad | Ingreso de informes, todos los informes en modo lectura, panel, gestión, log, configuración. |
| Administrador | Todo lo anterior y **Configuración → Usuarios y roles**. |

La identidad la da Supabase Auth (email y contraseña); el rol, la tabla `m06_usuarios`. Un usuario que existe en Auth
pero no está en `m06_usuarios` (o está inactivo) no entra. Sin base de datos configurada, la app es una demo abierta.

## Flujo de la etapa 1

1. La planilla de turnos (Google Sheets en `03_Turnos_mock_Visual_Medica`) simula a Visual Medica.
2. Los informes en PDF se dejan en `01_Informes_a_validar` (o se suben en **Ingreso de informes**).
3. Se extrae el texto del PDF, se identifica el turno y se ejecutan V1–V5.
4. El médico revisa las alertas en la vista pre-firma; cada decisión queda en el log inalterable.
5. Calidad sigue los indicadores en el panel y registra auditorías, acciones correctivas y débitos.

`fixtures/pdf/` tiene 6 informes PDF sintéticos y su planilla de turnos para probar el circuito completo
(se regeneran con `python3 scripts/generar_pdfs_sinteticos.py fixtures/pdf`).

## Privacidad

- Etapa 1 con datos **sintéticos**. Ningún dato corresponde a pacientes reales.
- Nombre, DNI y fecha de nacimiento nunca se envían a un modelo de IA: solo las secciones clínicas declaradas en cada prompt.
- Leyes 25.326 y 26.529. Marco de calidad: ISO 9001:2015.
