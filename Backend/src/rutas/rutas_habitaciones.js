const express = require('express');
const enrutador = express.Router();
const {
  obtenerHabitaciones,
  obtenerHabitacionPorId,
  crearHabitacion,
  actualizarHabitacion,
  checkinHabitacion,
  checkoutHabitacion,
  cambiarEstadoHabitacion,
  eliminarHabitacion
} = require('../controladores/controlador_habitaciones');

enrutador.get('/', obtenerHabitaciones);
enrutador.get('/:id', obtenerHabitacionPorId);
enrutador.post('/', crearHabitacion);
enrutador.put('/:id', actualizarHabitacion);
enrutador.post('/:id/checkin', checkinHabitacion);
enrutador.post('/:id/checkout', checkoutHabitacion);
enrutador.post('/:id/cambiar-estado', cambiarEstadoHabitacion);
enrutador.delete('/:id', eliminarHabitacion);

module.exports = enrutador;