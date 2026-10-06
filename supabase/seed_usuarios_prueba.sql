-- Roles de prueba (sin contraseñas). La contraseña la establece el administrador en
-- Configuración → Usuarios y roles; recién ahí se crea la cuenta en Supabase Auth.
insert into public.m06_usuarios (email, nombre, rol, medico_id, creado_por) values
 ('medico04@centrodrorellano.com', 'Médico 04 (prueba · mamografía)', 'medico', 'M04', 'pablovera77@gmail.com'),
 ('medico07@centrodrorellano.com', 'Médico 07 (prueba · densitometría)', 'medico', 'M07', 'pablovera77@gmail.com'),
 ('medico11@centrodrorellano.com', 'Médico 11 (prueba · ecografía)', 'medico', 'M11', 'pablovera77@gmail.com'),
 ('medico15@centrodrorellano.com', 'Médico 15 (prueba · radiografía)', 'medico', 'M15', 'pablovera77@gmail.com'),
 ('calidad@centrodrorellano.com', 'Calidad (prueba)', 'calidad', null, 'pablovera77@gmail.com')
on conflict (email) do nothing;
