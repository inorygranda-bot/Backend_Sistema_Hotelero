-- =============================================================================
-- ESQUEMA DE BASE DE DATOS: Sistema_Horel
-- Sistema de Gestión Hotelera - Módulo de Reservas, Tarifas y Facturación
-- =============================================================================

-- 1. ROLES Y PERMISOS
CREATE TABLE IF NOT EXISTS "rol" (
	"id_rol" serial NOT NULL,
	"nombre" varchar(50) NOT NULL UNIQUE,
	"descripcion" varchar(255) NOT NULL,
	PRIMARY KEY ("id_rol")
);

CREATE TABLE IF NOT EXISTS "modulo" (
	"id_modulo" serial NOT NULL,
	"nombre_modulo" varchar(100) NOT NULL UNIQUE,
	PRIMARY KEY ("id_modulo")
);

CREATE TABLE IF NOT EXISTS "rol_modulo" (
	"id_rol" integer NOT NULL,
	"id_modulo" integer NOT NULL,
	"acceso" varchar(50) NOT NULL,
	PRIMARY KEY ("id_rol", "id_modulo")
);

CREATE TABLE IF NOT EXISTS "funcion" (
	"id_funcion" serial NOT NULL,
	"id_modulo" integer NOT NULL,
	"nombre_funcion" varchar(100) NOT NULL,
	PRIMARY KEY ("id_funcion")
);

CREATE TABLE IF NOT EXISTS "rol_funcion" (
	"id_rol" integer NOT NULL,
	"id_funcion" integer NOT NULL,
	"acceso" varchar(50) NOT NULL,
	PRIMARY KEY ("id_rol", "id_funcion")
);

-- 2. USUARIOS Y AUDITORÍA
CREATE TABLE IF NOT EXISTS "usuario" (
	"id_usuario" serial NOT NULL,
	"id_rol" integer NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"correo" varchar(150) NOT NULL UNIQUE,
	"contrasenna" varchar(255) NOT NULL,
	"estado" varchar(20) NOT NULL DEFAULT 'ACTIVO',
	PRIMARY KEY ("id_usuario")
);

CREATE TABLE IF NOT EXISTS "auditoria" (
	"id_auditoria" serial NOT NULL,
	"id_usuario" integer NOT NULL,
	"modulo" varchar(100) NOT NULL,
	"fecha_hora" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"accion" varchar(255) NOT NULL,
	PRIMARY KEY ("id_auditoria")
);

-- 3. HUÉSPEDES
CREATE TABLE IF NOT EXISTS "huesped" (
	"id_huesped" serial NOT NULL,
	"tipo_documento" varchar(30) NOT NULL, 
	"nombre" varchar(100) NOT NULL,
	"telefono" varchar(25) NOT NULL,
	"estado" varchar(20) NOT NULL DEFAULT 'ACTIVO',
	"correo" varchar(255) NOT NULL,
	PRIMARY KEY ("id_huesped")
);

CREATE TABLE IF NOT EXISTS "documento_huesped" (
	"id_huesped" integer NOT NULL UNIQUE,
	"num_documento" varchar(255) NOT NULL UNIQUE,
	PRIMARY KEY ("id_huesped")
);

-- 4. HABITACIONES
CREATE TABLE IF NOT EXISTS "tipo_habitacion" (
	"id_tipo_habitacion" serial NOT NULL,
	"nombre_tipo" varchar(100) NOT NULL UNIQUE,
	"descripcion" text NOT NULL,
	PRIMARY KEY ("id_tipo_habitacion")
);

CREATE TABLE IF NOT EXISTS "habitacion" (
	"codigo_habitacion" serial NOT NULL,
	"id_tipo_habitacion" integer NOT NULL,
	"piso" varchar(10) NOT NULL,
	"capacidad" integer NOT NULL,
	"estado" varchar(20) NOT NULL DEFAULT 'DISPONIBLE',
	"amenidades" varchar(255) NOT NULL,
	PRIMARY KEY ("codigo_habitacion")
);

-- 5. TARIFAS Y CONFIGURACIÓN COMERCIAL (ACTUALIZADA)
CREATE TABLE IF NOT EXISTS "tarifa" (
	"id_tarifa" serial NOT NULL,
	"nombre_tarifa" varchar(100) NOT NULL,
	"ocupacion_base" integer NOT NULL DEFAULT 1,
	"vigente_desde" date NOT NULL,
	"vigente_hasta" date NOT NULL,
	"incluye" text NOT NULL,
	"precio_base" numeric(10,2) NOT NULL DEFAULT 120.00,
	"estado" varchar(20) NOT NULL DEFAULT 'Activa',
	"iva" numeric(5,2) NOT NULL DEFAULT 16.00,
	"huesped_adicional" numeric(10,2) NOT NULL DEFAULT 15.00,
	PRIMARY KEY ("id_tarifa")
);

CREATE TABLE IF NOT EXISTS "tarifa_hab" (
	"id_tarifa" integer NOT NULL, 
	"id_tipo_hab" integer NOT NULL,
	PRIMARY KEY ("id_tarifa", "id_tipo_hab")
);

-- 6. RECARGOS, RESERVAS Y PAGOS
CREATE TABLE IF NOT EXISTS "recargo" (
	"id_recargo" serial NOT NULL,
	"motivo_recargo" varchar(255) NOT NULL,
	"tipo_operacion" varchar(20) NOT NULL,
	"tipo_calculo" varchar(20) NOT NULL,
	"monto" numeric(10,2) NOT NULL DEFAULT 0.00,
	PRIMARY KEY ("id_recargo")
);

CREATE TABLE IF NOT EXISTS "reserva" (
	"codigo_reserva" serial NOT NULL,
	"id_huesped" integer NOT NULL,
	"codigo_habitacion" integer NOT NULL,
	"id_usuario" integer NOT NULL,
	"fecha_checkin" date NOT NULL,
	"fecha_checkout" date NOT NULL,
	"cantidad_huespedes" integer NOT NULL,
	"estado" varchar(20) NOT NULL DEFAULT 'PENDIENTE',
	"creado_en" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"monto_pagado" numeric(10,2) NOT NULL DEFAULT 0.00, 
	PRIMARY KEY ("codigo_reserva")
);

CREATE TABLE IF NOT EXISTS "reserva_recargo" (
	"codigo_reserva" integer NOT NULL,
	"id_recargo" integer NOT NULL,
	PRIMARY KEY ("codigo_reserva", "id_recargo")
);

CREATE TABLE IF NOT EXISTS "pago" (
	"id_pago" serial NOT NULL,
	"codigo_reserva" integer NOT NULL,
	"id_usuario" integer NOT NULL,
	"metodo_pago" varchar(50) NOT NULL,
	"fecha_pago" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"moneda" varchar(255) NOT NULL,
	"monto" numeric(10,2) NOT NULL, 
	"banco_destino" varchar(255),  
	"num_referencia" varchar(255), 
	"descripcion" varchar(255) NOT NULL,
	PRIMARY KEY ("id_pago")
);

-- =============================================================================
-- RELACIONES Y LLAVES FORÁNEAS
-- =============================================================================
ALTER TABLE "rol_modulo" DROP CONSTRAINT IF EXISTS "rol_modulo_fk0";
ALTER TABLE "rol_modulo" ADD CONSTRAINT "rol_modulo_fk0" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol");

ALTER TABLE "rol_modulo" DROP CONSTRAINT IF EXISTS "rol_modulo_fk1";
ALTER TABLE "rol_modulo" ADD CONSTRAINT "rol_modulo_fk1" FOREIGN KEY ("id_modulo") REFERENCES "modulo"("id_modulo");

ALTER TABLE "funcion" DROP CONSTRAINT IF EXISTS "funcion_fk1";
ALTER TABLE "funcion" ADD CONSTRAINT "funcion_fk1" FOREIGN KEY ("id_modulo") REFERENCES "modulo"("id_modulo");

ALTER TABLE "rol_funcion" DROP CONSTRAINT IF EXISTS "rol_funcion_fk0";
ALTER TABLE "rol_funcion" ADD CONSTRAINT "rol_funcion_fk0" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol");

ALTER TABLE "rol_funcion" DROP CONSTRAINT IF EXISTS "rol_funcion_fk1";
ALTER TABLE "rol_funcion" ADD CONSTRAINT "rol_funcion_fk1" FOREIGN KEY ("id_funcion") REFERENCES "funcion"("id_funcion");

ALTER TABLE "usuario" DROP CONSTRAINT IF EXISTS "usuario_fk1";
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_fk1" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol");

ALTER TABLE "habitacion" DROP CONSTRAINT IF EXISTS "habitacion_fk1";
ALTER TABLE "habitacion" ADD CONSTRAINT "habitacion_fk1" FOREIGN KEY ("id_tipo_habitacion") REFERENCES "tipo_habitacion"("id_tipo_habitacion");

ALTER TABLE "reserva" DROP CONSTRAINT IF EXISTS "reserva_fk1";
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_fk1" FOREIGN KEY ("id_huesped") REFERENCES "huesped"("id_huesped");

ALTER TABLE "reserva" DROP CONSTRAINT IF EXISTS "reserva_fk2";
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_fk2" FOREIGN KEY ("codigo_habitacion") REFERENCES "habitacion"("codigo_habitacion");

ALTER TABLE "reserva" DROP CONSTRAINT IF EXISTS "reserva_fk3";
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_fk3" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario");

ALTER TABLE "reserva_recargo" DROP CONSTRAINT IF EXISTS "reserva_recargo_fk0";
ALTER TABLE "reserva_recargo" ADD CONSTRAINT "reserva_recargo_fk0" FOREIGN KEY ("codigo_reserva") REFERENCES "reserva"("codigo_reserva");

ALTER TABLE "reserva_recargo" DROP CONSTRAINT IF EXISTS "reserva_recargo_fk1";
ALTER TABLE "reserva_recargo" ADD CONSTRAINT "reserva_recargo_fk1" FOREIGN KEY ("id_recargo") REFERENCES "recargo"("id_recargo");

ALTER TABLE "pago" DROP CONSTRAINT IF EXISTS "pago_fk1";
ALTER TABLE "pago" ADD CONSTRAINT "pago_fk1" FOREIGN KEY ("codigo_reserva") REFERENCES "reserva"("codigo_reserva");

ALTER TABLE "pago" DROP CONSTRAINT IF EXISTS "pago_fk2";
ALTER TABLE "pago" ADD CONSTRAINT "pago_fk2" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario");

ALTER TABLE "auditoria" DROP CONSTRAINT IF EXISTS "auditoria_fk1";
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_fk1" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario");

ALTER TABLE "documento_huesped" DROP CONSTRAINT IF EXISTS "documento_huesped_fk0";
ALTER TABLE "documento_huesped" ADD CONSTRAINT "documento_huesped_fk0" FOREIGN KEY ("id_huesped") REFERENCES "huesped"("id_huesped");

ALTER TABLE "tarifa_hab" DROP CONSTRAINT IF EXISTS "tarifa_hab_fk0";
ALTER TABLE "tarifa_hab" ADD CONSTRAINT "tarifa_hab_fk0" FOREIGN KEY ("id_tarifa") REFERENCES "tarifa"("id_tarifa") ON DELETE CASCADE;

ALTER TABLE "tarifa_hab" DROP CONSTRAINT IF EXISTS "tarifa_hab_fk1";
ALTER TABLE "tarifa_hab" ADD CONSTRAINT "tarifa_hab_fk1" FOREIGN KEY ("id_tipo_hab") REFERENCES "tipo_habitacion"("id_tipo_habitacion") ON DELETE CASCADE;

-- =============================================================================
-- COMENTARIOS DESCRIPTIVOS
-- =============================================================================
COMMENT ON COLUMN "habitacion"."amenidades" IS 'Artículos, productos de acogida o comodidades adicionales de la habitación que se ofrece de forma gratuita';
COMMENT ON COLUMN "tarifa"."incluye" IS 'Servicios, condiciones y amenidades incluidas en esta tarifa';
COMMENT ON COLUMN "tarifa"."precio_base" IS 'Precio base en USD por noche';
COMMENT ON COLUMN "tarifa"."estado" IS 'Estado comercial de la tarifa (Activa, Inactiva, Borrador)';
COMMENT ON COLUMN "tarifa"."iva" IS 'Porcentaje de IVA aplicable';
COMMENT ON COLUMN "tarifa"."huesped_adicional" IS 'Cargo adicional por huésped extra en USD';
COMMENT ON COLUMN "pago"."id_usuario" IS 'Usuario que registró el pago';
COMMENT ON COLUMN "pago"."moneda" IS 'Moneda en la que se realizó el pago original';
COMMENT ON COLUMN "pago"."monto" IS 'Monto del pago';
COMMENT ON TABLE "documento_huesped" IS 'Tabla para separar a quienes tengan o no números de documentos';
COMMENT ON TABLE "tarifa_hab" IS 'Relación de tarifas asignadas a cada tipo de habitación';

-- =============================================================================
<<<<<<< Updated upstream
-- 1. SEMILLA DE DATOS: Roles iniciales
-- =============================================================================
INSERT INTO "rol" ("id_rol", "nombre", "descripcion") VALUES
(1, 'Administrador General', 'Acceso total a todos los módulos y funciones del sistema'),
(2, 'Recepcionista', 'Permisos operativos de recepción, reservas y huéspedes')
ON CONFLICT ("id_rol") DO NOTHING;

-- =============================================================================
-- 2. SEMILLA DE DATOS: Módulos (Basados en el menú lateral)
-- =============================================================================
=======
-- SEMILLA DE DATOS COMPLETA Y SINCRONIZADA CON LA BASE DE DATOS REAL (Sistema_Horel)
-- =============================================================================

-- 1. Roles del Sistema
INSERT INTO "rol" ("id_rol", "nombre", "descripcion") VALUES
(1, 'Administrador General', 'Acceso total a todos los módulos y funciones del sistema'),
(2, 'Recepcionista', 'Permisos operativos de recepción, reservas y huéspedes')
ON CONFLICT ("id_rol") DO UPDATE 
SET "nombre" = EXCLUDED."nombre", "descripcion" = EXCLUDED."descripcion";

-- 2. Módulos del Sistema (Basados en el menú lateral)
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
ON CONFLICT ("id_modulo") DO NOTHING;

-- =============================================================================
-- 3. SEMILLA DE DATOS: Funciones principales por cada módulo
-- =============================================================================
=======
ON CONFLICT ("id_modulo") DO UPDATE 
SET "nombre_modulo" = EXCLUDED."nombre_modulo";

-- 3. Funciones principales por cada módulo
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
ON CONFLICT ("id_funcion") DO NOTHING;

-- =============================================================================
-- 4. SEMILLA DE DATOS: Usuario Administrador inicial
-- =============================================================================
INSERT INTO "usuario" ("id_usuario", "id_rol", "nombre", "correo", "contrasenna", "estado") 
VALUES (1, 1, 'Administrador General', 'admin@hotel.com', '$2b$10$r9Z4wV1v7...tu_hash_aqui...', 'ACTIVO')
ON CONFLICT ("id_usuario") DO NOTHING;
=======
ON CONFLICT ("id_funcion") DO UPDATE 
SET "id_modulo" = EXCLUDED."id_modulo", "nombre_funcion" = EXCLUDED."nombre_funcion";

-- 4. Permisos de Roles en Módulos (rol_modulo)
INSERT INTO "rol_modulo" ("id_rol", "id_modulo", "acceso") VALUES
(1, 1, 'TOTAL'),
(1, 2, 'TOTAL'),
(1, 3, 'TOTAL'),
(1, 4, 'TOTAL'),
(1, 5, 'TOTAL'),
(1, 6, 'TOTAL'),
(1, 7, 'TOTAL'),
(1, 8, 'TOTAL'),
(1, 9, 'TOTAL'),
(1, 10, 'TOTAL'),
(2, 1, 'TOTAL'),
(2, 2, 'TOTAL'),
(2, 3, 'TOTAL'),
(2, 5, 'TOTAL'),
(2, 6, 'TOTAL'),
(2, 10, 'TOTAL')
ON CONFLICT ("id_rol", "id_modulo") DO UPDATE 
SET "acceso" = EXCLUDED."acceso";

-- 5. Permisos de Roles en Funciones (rol_funcion)
INSERT INTO "rol_funcion" ("id_rol", "id_funcion", "acceso") VALUES
(1, 1, 'TOTAL'),
(1, 2, 'TOTAL'),
(1, 3, 'TOTAL'),
(1, 4, 'TOTAL'),
(1, 5, 'TOTAL'),
(1, 6, 'TOTAL'),
(1, 7, 'TOTAL'),
(1, 8, 'TOTAL'),
(1, 9, 'TOTAL'),
(1, 10, 'TOTAL'),
(2, 10, 'TOTAL')
ON CONFLICT ("id_rol", "id_funcion") DO UPDATE 
SET "acceso" = EXCLUDED."acceso";

-- 6. Usuarios del Sistema
-- Clave para admin@hotel.com: admin123
INSERT INTO "usuario" ("id_usuario", "id_rol", "nombre", "correo", "contrasenna", "estado") VALUES
(1, 1, 'Administrador General', 'admin@hotel.com', '$2b$10$mXakf2ycEOPohLjHb7J21eYbi09EJpof1XtTQfTAb5Y7c7qymTKyu', 'ACTIVO'),
(2, 2, 'Juan Perez', 'recepcion@gmail.com', '$2b$10$c9/2PwKCsZversEVoCJ35O1N0tPMqc6ZmQ60o9bl1XQc9.Pl5d57i', 'ACTIVO')
ON CONFLICT ("id_usuario") DO UPDATE 
SET "id_rol" = EXCLUDED."id_rol",
    "nombre" = EXCLUDED."nombre",
    "correo" = EXCLUDED."correo",
    "contrasenna" = EXCLUDED."contrasenna",
    "estado" = EXCLUDED."estado";

-- 7. Catálogo de Tipos de Habitación
INSERT INTO "tipo_habitacion" ("id_tipo_habitacion", "nombre_tipo", "descripcion") VALUES
(1, 'Suite ejecutiva', 'aaaa'),
(2, 'suite confort', 'super cuarto'),
(3, 'doble deluxe', 'aaaa')
ON CONFLICT ("id_tipo_habitacion") DO UPDATE 
SET "nombre_tipo" = EXCLUDED."nombre_tipo", "descripcion" = EXCLUDED."descripcion";

-- 8. Catálogo de Habitaciones y Capacidades
INSERT INTO "habitacion" ("codigo_habitacion", "id_tipo_habitacion", "piso", "capacidad", "estado", "amenidades") VALUES
(1, 1, '1', 2, 'Disponible', '1212'),
(2, 2, '1', 5, 'Disponible', '1212'),
(3, 1, '1', 2, 'Disponible', '1212'),
(4, 3, '1', 8, 'Disponible', '1212')
ON CONFLICT ("codigo_habitacion") DO UPDATE 
SET "id_tipo_habitacion" = EXCLUDED."id_tipo_habitacion",
    "piso" = EXCLUDED."piso",
    "capacidad" = EXCLUDED."capacidad",
    "estado" = EXCLUDED."estado",
    "amenidades" = EXCLUDED."amenidades";

-- 9. Catálogo de Tarifas Comerciales
INSERT INTO "tarifa" ("id_tarifa", "nombre_tarifa", "ocupacion_base", "vigente_desde", "vigente_hasta", "incluye", "precio_base", "estado", "iva", "huesped_adicional") VALUES
(1, 'Flexible Ejecutiva', 2, '2026-10-01', '2027-03-31', 'Incluye desayuno. No reembolsable dentro de las 48 horas previas.', 120.00, 'Activa', 16.00, 15.00),
(2, 'Flexible Ejecutiva', 5, '2026-10-01', '2027-03-31', 'Incluye desayuno. No reembolsable dentro de las 48 horas previas.', 90.00, 'Activa', 16.00, 15.00),
(3, 'Flexible Ejecutiva', 8, '2026-10-01', '2027-03-31', 'Incluye desayuno. No reembolsable dentro de las 48 horas previas.', 180.00, 'Activa', 16.00, 15.00)
ON CONFLICT ("id_tarifa") DO UPDATE 
SET "nombre_tarifa" = EXCLUDED."nombre_tarifa",
    "ocupacion_base" = EXCLUDED."ocupacion_base",
    "vigente_desde" = EXCLUDED."vigente_desde",
    "vigente_hasta" = EXCLUDED."vigente_hasta",
    "incluye" = EXCLUDED."incluye",
    "precio_base" = EXCLUDED."precio_base",
    "estado" = EXCLUDED."estado",
    "iva" = EXCLUDED."iva",
    "huesped_adicional" = EXCLUDED."huesped_adicional";

-- 10. Relación de Tarifas y Habitaciones
INSERT INTO "tarifa_hab" ("id_tarifa", "id_tipo_hab") VALUES
(1, 1),
(2, 2),
(3, 3)
ON CONFLICT ("id_tarifa", "id_tipo_hab") DO NOTHING;

-- =============================================================================
-- 11. SINCRONIZACIÓN DE SECUENCIAS (Para evitar colisiones de IDs al crear registros)
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
>>>>>>> Stashed changes
