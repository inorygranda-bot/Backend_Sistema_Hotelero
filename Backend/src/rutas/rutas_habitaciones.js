const express = require('express');
const enrutador = express.Router();
const {
  obtenerHabitaciones,
  obtenerHabitacionPorId,
  checkinHabitacion,
  checkoutHabitacion,
  cambiarEstadoHabitacion
} = require('../controladores/controlador_habitaciones');

// Definición de Endpoints
enrutador.get('/', obtenerHabitaciones);
enrutador.get('/:id', obtenerHabitacionPorId);
enrutador.post('/:id/checkin', checkinHabitacion);
enrutador.post('/:id/checkout', checkoutHabitacion);
enrutador.post('/:id/cambiar-estado', cambiarEstadoHabitacion);

module.exports = enrutador;