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

