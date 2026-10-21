
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
	"id_modulo" integer NOT NULL,
	"fecha_hora" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"accion" varchar(255) NOT NULL,
	PRIMARY KEY ("id_auditoria")
);

CREATE TABLE IF NOT EXISTS "huesped" (
	"id_huesped" serial NOT NULL,
	"tipo_documento" varchar(30) NOT NULL,
	"num_documento" varchar(255) NOT NULL UNIQUE,
	"nombre" varchar(100) NOT NULL,
	"telefono" varchar(25) NOT NULL,
	"estado" varchar(20) NOT NULL DEFAULT 'ACTIVO',
	"correo" varchar(255) NOT NULL,
	PRIMARY KEY ("id_huesped")
);

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

CREATE TABLE IF NOT EXISTS "banco" (
	"id_banco" serial NOT NULL,
	"nombre_banco" varchar(100) NOT NULL UNIQUE,
	PRIMARY KEY ("id_banco")
);

CREATE TABLE IF NOT EXISTS "temporada" (
	"id_temporada" serial NOT NULL,
	"nombre_temporada" varchar(50) NOT NULL UNIQUE,
	"fecha_inicio" varchar(5) NOT NULL, 
	"fecha_fin" varchar(5) NOT NULL,    
	"descripcion" varchar(255),
	PRIMARY KEY ("id_temporada")
);

CREATE TABLE IF NOT EXISTS "tarifa" (
	"id_tarifa" serial NOT NULL,
	"nombre_tarifa" varchar(100) NOT NULL,
	"ocupacion_base" integer NOT NULL DEFAULT 1,
	"incluye" text NOT NULL,
	"precio_base" numeric(10,2) NOT NULL DEFAULT 120.00,
	"estado" varchar(20) NOT NULL DEFAULT 'Activa',
	"iva" numeric(5,2) NOT NULL DEFAULT 16.00,
	"huesped_adicional" numeric(10,2) NOT NULL DEFAULT 15.00,
	PRIMARY KEY ("id_tarifa")
);

CREATE TABLE IF NOT EXISTS "tarifa_temporada" (
	"id_tarifa" integer NOT NULL,
	"id_temporada" integer NOT NULL,
	PRIMARY KEY ("id_tarifa", "id_temporada")
);

CREATE TABLE IF NOT EXISTS "tarifa_hab" (
	"id_tarifa" integer NOT NULL,
	"id_tipo_hab" integer NOT NULL,
	PRIMARY KEY ("id_tarifa", "id_tipo_hab")
);

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

CREATE TABLE IF NOT EXISTS "checkin" (
	"id_checkin" serial NOT NULL,
	"codigo_reserva" integer NOT NULL UNIQUE,
	"fecha_hora_entrada" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"cantidad_acompanantes" integer NOT NULL DEFAULT 0,
	"cantidad_maletas" integer NOT NULL DEFAULT 0,
	"observaciones" text,
	PRIMARY KEY ("id_checkin")
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
	"descripcion" varchar(255) NOT NULL,
	PRIMARY KEY ("id_pago")
);

CREATE TABLE IF NOT EXISTS "transaccion_bancaria" (
	"id_transaccion" serial NOT NULL,
	"id_pago" integer NOT NULL UNIQUE,
	"id_banco_origen" integer NOT NULL,
	"id_banco_destino" integer NOT NULL,
	"num_referencia" varchar(255) NOT NULL UNIQUE,
	PRIMARY KEY ("id_transaccion")
);

CREATE TABLE IF NOT EXISTS "emergencia_log" (
	"id_emergencia" serial NOT NULL,
	"id_usuario" integer NOT NULL,
	"fecha_hora_activacion" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"estado" varchar(20) NOT NULL DEFAULT 'ALERTA',
	"mensaje_emitido" text NOT NULL,
	PRIMARY KEY ("id_emergencia")
);

ALTER TABLE "funcion" ADD CONSTRAINT "funcion_fk1" FOREIGN KEY ("id_modulo") REFERENCES "modulo"("id_modulo");

ALTER TABLE "rol_funcion" ADD CONSTRAINT "rol_funcion_fk0" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol");
ALTER TABLE "rol_funcion" ADD CONSTRAINT "rol_funcion_fk1" FOREIGN KEY ("id_funcion") REFERENCES "funcion"("id_funcion");

ALTER TABLE "usuario" ADD CONSTRAINT "usuario_fk1" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol");

ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_fk1" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario");
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_fk2" FOREIGN KEY ("id_modulo") REFERENCES "modulo"("id_modulo");

ALTER TABLE "habitacion" ADD CONSTRAINT "habitacion_fk1" FOREIGN KEY ("id_tipo_habitacion") REFERENCES "tipo_habitacion"("id_tipo_habitacion");

ALTER TABLE "tarifa_temporada" ADD CONSTRAINT "tarifa_temporada_fk0" FOREIGN KEY ("id_tarifa") REFERENCES "tarifa"("id_tarifa") ON DELETE CASCADE;
ALTER TABLE "tarifa_temporada" ADD CONSTRAINT "tarifa_temporada_fk1" FOREIGN KEY ("id_temporada") REFERENCES "temporada"("id_temporada") ON DELETE CASCADE;

ALTER TABLE "tarifa_hab" ADD CONSTRAINT "tarifa_hab_fk0" FOREIGN KEY ("id_tarifa") REFERENCES "tarifa"("id_tarifa") ON DELETE CASCADE;
ALTER TABLE "tarifa_hab" ADD CONSTRAINT "tarifa_hab_fk1" FOREIGN KEY ("id_tipo_hab") REFERENCES "tipo_habitacion"("id_tipo_habitacion") ON DELETE CASCADE;

ALTER TABLE "reserva" ADD CONSTRAINT "reserva_fk1" FOREIGN KEY ("id_huesped") REFERENCES "huesped"("id_huesped");
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_fk2" FOREIGN KEY ("codigo_habitacion") REFERENCES "habitacion"("codigo_habitacion");
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_fk3" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario");

ALTER TABLE "checkin" ADD CONSTRAINT "checkin_fk_reserva" FOREIGN KEY ("codigo_reserva") REFERENCES "reserva"("codigo_reserva") ON DELETE CASCADE;

ALTER TABLE "reserva_recargo" ADD CONSTRAINT "reserva_recargo_fk0" FOREIGN KEY ("codigo_reserva") REFERENCES "reserva"("codigo_reserva");
ALTER TABLE "reserva_recargo" ADD CONSTRAINT "reserva_recargo_fk1" FOREIGN KEY ("id_recargo") REFERENCES "recargo"("id_recargo");

ALTER TABLE "pago" ADD CONSTRAINT "pago_fk1" FOREIGN KEY ("codigo_reserva") REFERENCES "reserva"("codigo_reserva");
ALTER TABLE "pago" ADD CONSTRAINT "pago_fk2" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario");

ALTER TABLE "transaccion_bancaria" ADD CONSTRAINT "transaccion_bancaria_fk_pago" FOREIGN KEY ("id_pago") REFERENCES "pago"("id_pago") ON DELETE CASCADE;
ALTER TABLE "transaccion_bancaria" ADD CONSTRAINT "transaccion_bancaria_fk_origen" FOREIGN KEY ("id_banco_origen") REFERENCES "banco"("id_banco");
ALTER TABLE "transaccion_bancaria" ADD CONSTRAINT "transaccion_bancaria_fk_destino" FOREIGN KEY ("id_banco_destino") REFERENCES "banco"("id_banco");

ALTER TABLE "emergencia_log" ADD CONSTRAINT "emergencia_log_fk0" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario");

INSERT INTO "rol" ("id_rol", "nombre", "descripcion") VALUES
(1, 'Administrador General', 'Acceso total a todos los módulos y funciones del sistema'),
(2, 'Recepcionista', 'Permisos operativos de recepción, reservas y huéspedes')
ON CONFLICT ("id_rol") DO NOTHING;

INSERT INTO "modulo" ("id_modulo", "nombre_modulo") VALUES
(1, 'Inicio'),
(2, 'Reservas'),
(3, 'Huéspedes'),
(4, 'Finanzas'),
(5, 'Habitaciones'),
(6, 'Tarifas'),
(7, 'Auditoría'),
(8, 'Control Emergencia'),
(9, 'Rol y Usuarios')
ON CONFLICT ("id_modulo") DO NOTHING;

INSERT INTO "funcion" ("id_funcion", "id_modulo", "nombre_funcion") VALUES
-- Módulo 1: Inicio
(1, 1, 'Ver Inicio'),
-- Módulo 2: Reservas
(2, 2, 'Ver Reservas'),
(3, 2, 'Crear Reservas'),
(4, 2, 'Editar Reservas'),
(5, 2, 'Eliminar Reservas'),
-- Módulo 3: Huéspedes
(6, 3, 'Ver Huéspedes'),
(7, 3, 'Crear Huéspedes'),
(8, 3, 'Editar Huéspedes'),
(9, 3, 'Eliminar Huéspedes'),
-- Módulo 4: Finanzas
(10, 4, 'Ver Finanzas'),
(11, 4, 'Gestionar Pagos y Transacciones'),
-- Módulo 5: Habitaciones
(12, 5, 'Ver Habitaciones'),
(13, 5, 'Crear Habitaciones'),
(14, 5, 'Editar Habitaciones'),
(15, 5, 'Eliminar Habitaciones'),
-- Módulo 6: Tarifas
(16, 6, 'Ver Tarifas'),
(17, 6, 'Crear Tarifas'),
(18, 6, 'Editar Tarifas'),
(19, 6, 'Eliminar Tarifas'),
-- Módulo 7: Auditoría
(20, 7, 'Ver Auditoría'),
-- Módulo 8: Control Emergencia
(21, 8, 'Ver Control de Emergencia'),
(22, 8, 'Activar Alertas de Emergencia'),
-- Módulo 9: Rol y Usuarios
(23, 9, 'Ver Roles y Usuarios'),
(24, 9, 'Crear Roles y Usuarios'),
(25, 9, 'Editar Roles y Usuarios'),
(26, 9, 'Eliminar Roles y Usuarios')
ON CONFLICT ("id_funcion") DO NOTHING;

INSERT INTO "rol_funcion" ("id_rol", "id_funcion", "acceso") 
SELECT 1, "id_funcion", 'TOTAL' FROM "funcion"
ON CONFLICT ("id_rol", "id_funcion") DO NOTHING;

INSERT INTO "usuario" ("id_usuario", "id_rol", "nombre", "correo", "contrasenna", "estado") 
VALUES (1, 1, 'Administrador General', 'admin@hotel.com', '$2b$10$mXakf2ycEOPohLjHb7J21eYbi09EJpof1XtTQfTAb5Y7c7qymTKyu', 'ACTIVO')
ON CONFLICT ("id_usuario") DO NOTHING;

INSERT INTO temporada (nombre_temporada, fecha_inicio, fecha_fin, descripcion)
VALUES ('Temporada normal', 'N/A', 'N/A', 'Tarifa base para la habitacion')
ON CONFLICT (nombre_temporada) DO NOTHING;

-- Agregar campos de Telegram a la tabla reserva existente
ALTER TABLE "reserva" ADD COLUMN IF NOT EXISTS "id_telegram" varchar(100) DEFAULT NULL;
ALTER TABLE "reserva" ADD COLUMN IF NOT EXISTS "usuario_telegram" varchar(100) DEFAULT NULL;

-- Tabla para llevar el registro de notificaciones enviadas al chat del huésped
CREATE TABLE IF NOT EXISTS "telegram_notificacion_log" (
	"id_notificacion" serial NOT NULL,
	"codigo_reserva" integer NOT NULL,
	"fecha_hora" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"mensaje" text NOT NULL,
	"entregado" boolean NOT NULL DEFAULT TRUE,
	PRIMARY KEY ("id_notificacion")
);

ALTER TABLE "telegram_notificacion_log" ADD CONSTRAINT "telegram_notificacion_log_fk_reserva" 
FOREIGN KEY ("codigo_reserva") REFERENCES "reserva"("codigo_reserva") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "huesped_telegram" (
	"id_huesped" integer NOT NULL,
	"id_telegram" varchar(100) NOT NULL UNIQUE,
	"usuario_telegram" varchar(100),
	PRIMARY KEY ("id_huesped"),
	CONSTRAINT "huesped_telegram_fk_huesped" 
	FOREIGN KEY ("id_huesped") REFERENCES "huesped"("id_huesped") ON DELETE CASCADE
);

ALTER TABLE "huesped" ADD COLUMN IF NOT EXISTS "num_documento" varchar(255);