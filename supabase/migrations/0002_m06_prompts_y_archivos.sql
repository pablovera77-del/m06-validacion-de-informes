-- Quién subió cada archivo (el médico ve solo lo suyo).
alter table public.m06_archivos add column if not exists subido_por text;
create index if not exists m06_archivos_subido_por on public.m06_archivos (subido_por);

-- Prompts de IA editables desde la app, versionados (ISO 9001 7.5 y 8.5.6).
-- Flujo: borrador → probado con el modelo real → aprobado y vigente. La versión anterior queda retirada.
-- Las versiones nunca se borran; un borrador se puede descartar.
create table if not exists public.m06_prompts (
  id uuid primary key default gen_random_uuid(),
  validacion text not null check (validacion in ('V3A','V5')),
  version text not null,
  estado text not null default 'borrador' check (estado in ('borrador','vigente','retirada','descartada')),
  sistema text not null check (length(sistema) between 50 and 12000),
  motivo text not null,
  base_version text,
  autor text not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  probado_por text,
  probado_en timestamptz,
  aprobado_por text,
  aprobado_en timestamptz,
  unique (validacion, version)
);
create unique index if not exists m06_prompts_un_vigente on public.m06_prompts (validacion) where estado = 'vigente';
create unique index if not exists m06_prompts_un_borrador on public.m06_prompts (validacion) where estado = 'borrador';
alter table public.m06_prompts enable row level security;
revoke all on public.m06_prompts from anon, authenticated;
