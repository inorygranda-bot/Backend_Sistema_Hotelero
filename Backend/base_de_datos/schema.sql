-- =============================================================================
-- SEMILLA DE DATOS COMPLETA Y SINCRONIZADA
-- =============================================================================

-- 1. Roles del Sistema
INSERT INTO "rol" ("id_rol", "nombre", "descripcion") VALUES
(1, 'Administrador General', 'Acceso total a todos los módulos y funciones del sistema'),
(2, 'Recepcionista', 'Permisos operativos de recepción, reservas y huéspedes')
ON CONFLICT ("id_rol") DO UPDATE 
SET "nombre" = EXCLUDED."nombre", "descripcion" = EXCLUDED."descripcion";

-- 2. Módulos del Sistema (Basados en el menú lateral)
INSERT INTO "modulo" ("id_modulo", "nombre_modulo") VALUES
(1, 'Inicio'),
(2, 'Reservas'),
(3, 'Huéspedes'),
(4, 'Finanzas'),
(5, 'Habitaciones'),
(6, 'Tarifas'),
(7, 'Auditoría'),
(8, 'Control de emergencias'),
(9, 'Rol y Usuarios'),
(10, 'Chat Chavoo')
ON CONFLICT ("id_modulo") DO UPDATE 
SET "nombre_modulo" = EXCLUDED."nombre_modulo";

-- 3. Funciones principales por cada módulo
INSERT INTO "funcion" ("id_funcion", "id_modulo", "nombre_funcion") VALUES
(1, 1, 'Ver Inicio'),
(2, 2, 'Gestionar Reservas'),
(3, 3, 'Gestionar Huéspedes'),
(4, 4, 'Gestionar Finanzas'),
(5, 5, 'Gestionar Habitaciones'),
(6, 6, 'Gestionar Tarifas'),
(7, 7, 'Ver Auditoría'),
(8, 8, 'Control de emergencias'),
(9, 9, 'Gestionar Rol y Usuarios'),
(10, 10, 'Usar Chat Chavoo')
ON CONFLICT ("id_funcion") DO UPDATE 
SET "id_modulo" = EXCLUDED."id_modulo", "nombre_funcion" = EXCLUDED."nombre_funcion";

-- 4. Permisos de Roles en Módulos (rol_modulo)
INSERT INTO "rol_modulo" ("id_rol", "id_modulo", "acceso") VALUES
(1, 1, 'TOTAL'), (1, 2, 'TOTAL'), (1, 3, 'TOTAL'), (1, 4, 'TOTAL'),
(1, 5, 'TOTAL'), (1, 6, 'TOTAL'), (1, 7, 'TOTAL'), (1, 8, 'TOTAL'),
(1, 9, 'TOTAL'), (1, 10, 'TOTAL'),
(2, 1, 'TOTAL'), (2, 2, 'TOTAL'), (2, 3, 'TOTAL'), (2, 5, 'TOTAL'),
(2, 6, 'TOTAL'), (2, 10, 'TOTAL')
ON CONFLICT ("id_rol", "id_modulo") DO UPDATE 
SET "acceso" = EXCLUDED."acceso";

-- 5. Permisos de Roles en Funciones (rol_funcion)
INSERT INTO "rol_funcion" ("id_rol", "id_funcion", "acceso") VALUES
(1, 1, 'TOTAL'), (1, 2, 'TOTAL'), (1, 3, 'TOTAL'), (1, 4, 'TOTAL'),
(1, 5, 'TOTAL'), (1, 6, 'TOTAL'), (1, 7, 'TOTAL'), (1, 8, 'TOTAL'),
(1, 9, 'TOTAL'), (1, 10, 'TOTAL'), (2, 10, 'TOTAL')
ON CONFLICT ("id_rol", "id_funcion") DO UPDATE 
SET "acceso" = EXCLUDED."acceso";

-- 6. Usuarios del Sistema
-- Clave para admin@hotel.com: admin123
INSERT INTO "usuario" ("id_usuario", "id_rol", "nombre", "correo", "contrasenna", "estado") VALUES
(1, 1, 'Administrador General', 'admin@hotel.com', '$2b$10$mXakf2ycEOPohLjHb7J21eYbi09EJpof1XtTQfTAb5Y7c7qymTKyu', 'ACTIVO'),
(2, 2, 'Juan Perez', 'recepcion@gmail.com', '$2b$10$c9/2PwKCsZversEVoCJ35O1N0tPMqc6ZmQ60o9bl1XQc9.Pl5d57i', 'ACTIVO')
ON CONFLICT ("id_usuario") DO UPDATE 
SET "id_rol" = EXCLUDED."id_rol", "nombre" = EXCLUDED."nombre", "correo" = EXCLUDED."correo", "contrasenna" = EXCLUDED."contrasenna", "estado" = EXCLUDED."estado";

-- 7. Catálogo de Tipos de Habitación (Textos limpios)
INSERT INTO "tipo_habitacion" ("id_tipo_habitacion", "nombre_tipo", "descripcion") VALUES
(1, 'Suite Ejecutiva', 'Habitación ejecutiva con amenidades de negocios y escritorio'),
(2, 'Habitación Estándar', 'Habitación estándar confortable con cama queen y baño privado'),
(3, 'Habitación Doble Deluxe', 'Habitación doble superior con balcón y vista a la ciudad'),
(4, 'Suite Presidencial', 'Suite de máximo lujo con cava, jacuzzi y mayordomo privado'),
(5, 'Suite Junior', 'Suite espaciosa para estadías corporativas prolongadas o parejas')
ON CONFLICT ("id_tipo_habitacion") DO UPDATE 
SET "nombre_tipo" = EXCLUDED."nombre_tipo", "descripcion" = EXCLUDED."descripcion";

-- 8. Catálogo de Habitaciones y Capacidades
INSERT INTO "habitacion" ("codigo_habitacion", "id_tipo_habitacion", "piso", "capacidad", "estado", "amenidades") VALUES
(1, 1, '1', 2, 'Disponible', 'TV, Wifi, Minibar'),
(2, 2, '1', 5, 'Disponible', 'TV, Wifi'),
(3, 1, '1', 2, 'Disponible', 'TV, Wifi, Minibar'),
(4, 3, '1', 8, 'Disponible', 'TV, Wifi, Balcón')
ON CONFLICT ("codigo_habitacion") DO UPDATE 
SET "id_tipo_habitacion" = EXCLUDED."id_tipo_habitacion", "piso" = EXCLUDED."piso", "capacidad" = EXCLUDED."capacidad", "estado" = EXCLUDED."estado", "amenidades" = EXCLUDED."amenidades";

-- 9. Catálogo de Tarifas Comerciales
INSERT INTO "tarifa" ("id_tarifa", "nombre_tarifa", "ocupacion_base", "vigente_desde", "vigente_hasta", "incluye", "precio_base", "estado", "iva", "huesped_adicional") VALUES
(1, 'Flexible Ejecutiva', 2, '2026-10-01', '2027-03-31', 'Incluye desayuno. No reembolsable dentro de las 48 horas previas.', 120.00, 'Activa', 16.00, 15.00),
(2, 'Flexible Estándar', 5, '2026-10-01', '2027-03-31', 'Incluye desayuno. No reembolsable dentro de las 48 horas previas.', 90.00, 'Activa', 16.00, 15.00),
(3, 'Flexible Deluxe', 8, '2026-10-01', '2027-03-31', 'Incluye desayuno. No reembolsable dentro de las 48 horas previas.', 180.00, 'Activa', 16.00, 15.00)
ON CONFLICT ("id_tarifa") DO UPDATE 
SET "nombre_tarifa" = EXCLUDED."nombre_tarifa", "ocupacion_base" = EXCLUDED."ocupacion_base", "vigente_desde" = EXCLUDED."vigente_desde", "vigente_hasta" = EXCLUDED."vigente_hasta", "incluye" = EXCLUDED."incluye", "precio_base" = EXCLUDED."precio_base", "estado" = EXCLUDED."estado", "iva" = EXCLUDED."iva", "huesped_adicional" = EXCLUDED."huesped_adicional";

-- 10. Relación de Tarifas y Habitaciones
INSERT INTO "tarifa_hab" ("id_tarifa", "id_tipo_hab") VALUES
(1, 1),
(2, 2),
(3, 3)
ON CONFLICT ("id_tarifa", "id_tipo_hab") DO NOTHING;

-- =============================================================================
-- 11. SINCRONIZACIÓN DE SECUENCIAS
-- =============================================================================
SELECT pg_catalog.setval('public.rol_id_rol_seq', (SELECT COALESCE(MAX(id_rol), 1) FROM rol), true);
SELECT pg_catalog.setval('public.modulo_id_modulo_seq', (SELECT COALESCE(MAX(id_modulo), 1) FROM modulo), true);
SELECT pg_catalog.setval('public.funcion_id_funcion_seq', (SELECT COALESCE(MAX(id_funcion), 1) FROM funcion), true);
SELECT pg_catalog.setval('public.usuario_id_usuario_seq', (SELECT COALESCE(MAX(id_usuario), 1) FROM usuario), true);
SELECT pg_catalog.setval('public.tipo_habitacion_id_tipo_habitacion_seq', (SELECT COALESCE(MAX(id_tipo_habitacion), 1) FROM tipo_habitacion), true);
SELECT pg_catalog.setval('public.habitacion_codigo_habitacion_seq', (SELECT COALESCE(MAX(codigo_habitacion), 1) FROM habitacion), true);
SELECT pg_catalog.setval('public.tarifa_id_tarifa_seq', (SELECT COALESCE(MAX(id_tarifa), 1) FROM tarifa), true);
SELECT pg_catalog.setval('public.huesped_id_huesped_seq', (SELECT COALESCE(MAX(id_huesped), 1) FROM huesped), false);
SELECT pg_catalog.setval('public.recargo_id_recargo_seq', (SELECT COALESCE(MAX(id_recargo), 1) FROM recargo), false);
SELECT pg_catalog.setval('public.reserva_codigo_reserva_seq', (SELECT COALESCE(MAX(codigo_reserva), 1) FROM reserva), false);
SELECT pg_catalog.setval('public.pago_id_pago_seq', (SELECT COALESCE(MAX(id_pago), 1) FROM pago), false);
SELECT pg_catalog.setval('public.auditoria_id_auditoria_seq', (SELECT COALESCE(MAX(id_auditoria), 1) FROM auditoria), false);