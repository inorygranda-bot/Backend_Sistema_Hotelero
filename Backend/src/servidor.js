require('dotenv').config();

const express = require('express');
const cors = require('cors');
const telegramBot = require('./telegramBot');

process.once('SIGINT', () => telegramBot.stop('SIGINT'));
process.once('SIGTERM', () => telegramBot.stop('SIGTERM'));

// Importación de rutas de cada módulo
const rutasHuespedes = require('./rutas/rutas_huespedes');
const rutasTarifas = require('./rutas/rutas_tarifas');
const rutasHabitaciones = require('./rutas/rutas_habitaciones');
const tiposHabitacion = require('./rutas/rutas_tipos_habitacion');
const rutasRecargos = require('./rutas/rutas_recargos');
const rutasRoles = require('./rutas/rutas_roles');       
const rutasUsuarios = require('./rutas/rutas_usuarios');
const rutasModulos = require('./rutas/rutas_modulos');
const rutasReservas = require('./rutas/rutas_reservas');
const rutasPagos = require('./rutas/rutas_pagos');
const rutasEmergencia = require('./rutas/rutas_emergencia');
const rutasAuditoria = require('./rutas/rutas_auditoria');
const rutasTemporadas = require('./rutas/rutas_temporadas');
const rutasBancos = require('./rutas/rutas_bancos');


const aplicacion = express();
const PUERTO = process.env.PORT || 3000;

// Middlewares universales
aplicacion.use(cors());
aplicacion.use(express.json());

// Registro de rutas por módulo
aplicacion.use('/api/huespedes', rutasHuespedes);
aplicacion.use('/api/tarifas', rutasTarifas);
aplicacion.use('/api/habitaciones', rutasHabitaciones);
aplicacion.use('/api/tipos-habitacion', tiposHabitacion);
aplicacion.use('/api/recargos', rutasRecargos);
aplicacion.use('/api/roles', rutasRoles);        
aplicacion.use('/api/usuarios', rutasUsuarios);
aplicacion.use('/api/modulos', rutasModulos);
aplicacion.use('/api/reservas', rutasReservas);
aplicacion.use('/api/pagos', rutasPagos);
aplicacion.use('/api/emergencia', rutasEmergencia);
aplicacion.use('/api/auditoria', rutasAuditoria);
aplicacion.use('/api/temporadas', rutasTemporadas);
aplicacion.use('/api/bancos', rutasBancos);

// Ruta base de prueba
aplicacion.get('/', (peticion, respuesta) => {
  respuesta.send('Servidor del Sistema Hotelero ejecutándose correctamente');
});

// Inicio del servidor
aplicacion.listen(PUERTO, () => {
  console.log(`Servidor escuchando en el puerto ${PUERTO}`);
});

telegramBot.launch().then(() => {
  console.log('Bot de Telegram iniciado y escuchando mensajes correctamente.');
}).catch(err => {
  console.error('Error al iniciar el bot de Telegram:', err);
});