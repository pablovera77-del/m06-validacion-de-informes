-- M06 Validación de Informes · esquema inicial
-- Proyecto Supabase: CDO - CONTACTOS. Tablas con prefijo m06_; no modifica cdo_contactos.
-- RLS activado sin políticas: solo el servidor (clave secreta de Supabase) accede. Nada queda expuesto a clientes anónimos.

create table if not exists public.m06_turnos (
  id text primary key,
  apellido_nombre text not null,
  dni text not null,
  fecha_nacimiento text not null,
  tipo_estudio text not null,
  medico_id text not null,
  origen text not null default 'drive',
  actualizado_en timestamptz not null default now()
);

create table if not exists public.m06_informes (
  id text primary key,
  turno_id text not null,
  version int not null default 1,
  informe_anterior_id text references public.m06_informes(id),
  tipo_estudio text not null,
  medico_id text not null,
  medico_firmante text,
  fecha timestamptz not null,
  encabezado jsonb not null default '{}'::jsonb,
  secciones jsonb not null default '{}'::jsonb,
  origen text not null check (origen in ('drive','api','sintetico','carga_manual')),
  archivo text,
  archivo_drive_id text,
  hash_archivo text,
  estado text not null default 'pendiente_firma' check (estado in ('pendiente_firma','firmado','reemplazado')),
  firmado_en timestamptz,
  creado_en timestamptz not null default now()
);
create index if not exists m06_informes_medico_tipo_fecha on public.m06_informes (medico_id, tipo_estudio, fecha desc);
create index if not exists m06_informes_turno on public.m06_informes (turno_id);

create table if not exists public.m06_validaciones (
  id uuid primary key default gen_random_uuid(),
  informe_id text not null references public.m06_informes(id),
  fecha timestamptz not null default now(),
  version_reglas text not null,
  versiones_prompt jsonb not null default '[]'::jsonb,
  resultados jsonb not null,
  nivel_maximo text,
  incompleto boolean not null default false
);
create index if not exists m06_validaciones_informe on public.m06_validaciones (informe_id, fecha desc);

create table if not exists public.m06_alertas (
  id uuid primary key default gen_random_uuid(),
  alerta_clave text not null,
  validacion_id uuid not null references public.m06_validaciones(id),
  informe_id text not null references public.m06_informes(id),
  validacion text not null,
  nivel text not null check (nivel in ('azul','amarilla','naranja','roja')),
  titulo text not null,
  detalle text not null,
  evidencia jsonb not null default '[]'::jsonb,
  version_reglas text not null,
  version_prompt text,
  estado text not null default 'pendiente' check (estado in ('pendiente','revisada','override','marcada_incorrecta','resuelta')),
  justificacion text,
  motivo_incorrecta text,
  actualizado_por text,
  actualizado_en timestamptz not null default now(),
  unique (validacion_id, alerta_clave)
);
create index if not exists m06_alertas_informe on public.m06_alertas (informe_id);

-- Log de auditoría: solo agregado, con cadena de hash (Ley 26.529 art. 13).
-- El trigger impide UPDATE, DELETE y TRUNCATE, y exige que cada entrada encadene con la anterior.
create table if not exists public.m06_log (
  secuencia bigint primary key,
  fecha text not null, -- ISO 8601 exactamente como entra en el hash
  tipo text not null,
  actor text not null,
  informe_id text,
  datos jsonb not null default '{}'::jsonb,
  hash_anterior text not null,
  hash text not null unique,
  registrado_en timestamptz not null default now()
);

create or replace function public.m06_log_control() returns trigger
language plpgsql set search_path = '' as $$
declare
  ultimo record;
begin
  if tg_op <> 'INSERT' then
    raise exception 'm06_log es de solo agregado: no se permite %', tg_op;
  end if;
  lock table public.m06_log in share row exclusive mode;
  select secuencia, hash into ultimo from public.m06_log order by secuencia desc limit 1;
  if ultimo is null then
    if new.secuencia <> 1 or new.hash_anterior <> repeat('0', 64) then
      raise exception 'La primera entrada debe tener secuencia 1 y hash inicial';
    end if;
  elsif new.secuencia <> ultimo.secuencia + 1 or new.hash_anterior <> ultimo.hash then
    raise exception 'La entrada no encadena con la anterior (esperado secuencia %)', ultimo.secuencia + 1 using errcode = '40001';
  end if;
  return new;
end $$;

drop trigger if exists m06_log_solo_agregado on public.m06_log;
create trigger m06_log_solo_agregado before insert or update or delete on public.m06_log
  for each row execute function public.m06_log_control();
drop trigger if exists m06_log_sin_truncate on public.m06_log;
create trigger m06_log_sin_truncate before truncate on public.m06_log
  for each statement execute function public.m06_log_control();

create table if not exists public.m06_auditoria_muestra (
  id uuid primary key default gen_random_uuid(),
  alerta_id uuid not null references public.m06_alertas(id),
  validacion text not null,
  correcta boolean not null,
  override_apropiado boolean,
  comentario text,
  auditor text not null,
  fecha timestamptz not null default now()
);

create table if not exists public.m06_acciones_correctivas (
  id text primary key,
  fecha date not null,
  patron text not null,
  accion text not null,
  responsable text not null,
  estado text not null default 'abierta' check (estado in ('abierta','en_curso','cerrada')),
  cierre text,
  actualizado_en timestamptz not null default now()
);

create table if not exists public.m06_debitos (
  id uuid primary key default gen_random_uuid(),
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  causa text not null check (causa in ('informe','otra')),
  cantidad int not null check (cantidad >= 0),
  monto numeric(14,2) not null default 0,
  financiador text,
  nota text,
  cargado_por text not null,
  creado_en timestamptz not null default now()
);

create table if not exists public.m06_archivos (
  id text primary key,
  nombre text not null,
  origen text not null check (origen in ('drive','carga_manual')),
  modificado_en timestamptz,
  informe_id text references public.m06_informes(id),
  estado text not null check (estado in ('procesado','error','ignorado')),
  error text,
  procesado_en timestamptz not null default now()
);

alter table public.m06_turnos enable row level security;
alter table public.m06_informes enable row level security;
alter table public.m06_validaciones enable row level security;
alter table public.m06_alertas enable row level security;
alter table public.m06_log enable row level security;
alter table public.m06_auditoria_muestra enable row level security;
alter table public.m06_acciones_correctivas enable row level security;
alter table public.m06_debitos enable row level security;
alter table public.m06_archivos enable row level security;

revoke all on public.m06_turnos, public.m06_informes, public.m06_validaciones, public.m06_alertas, public.m06_log,
  public.m06_auditoria_muestra, public.m06_acciones_correctivas, public.m06_debitos, public.m06_archivos
  from anon, authenticated;
