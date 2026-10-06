const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importación de rutas de cada módulo
const rutasHuespedes = require('./rutas/rutas_huespedes');
// Ejemplo de módulos de compañeros:
// const rutasHabitaciones = require('./rutas/rutasHabitaciones');
// const rutasReservas = require('./rutas/rutasReservas');

const aplicacion = express();
const PUERTO = process.env.PORT || 3000;

// Middlewares universales
aplicacion.use(cors());
aplicacion.use(express.json());

// Registro de rutas por módulo
aplicacion.use('/api/huespedes', rutasHuespedes);
// aplicacion.use('/api/habitaciones', rutasHabitaciones);
// aplicacion.use('/api/reservas', rutasReservas);

// Ruta base de prueba
aplicacion.get('/', (peticion, respuesta) => {
  respuesta.send('Servidor del Sistema Hotelero ejecutándose correctamente');
});

// Inicio del servidor
aplicacion.listen(PUERTO, () => {
  console.log(`Servidor escuchando en el puerto ${PUERTO}`);
});