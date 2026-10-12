const express = require('express');
const enrutador = express.Router();
const {
  obtenerReservas,
  obtenerReservaPorId,
  crearReserva,
  actualizarReserva,
  cambiarEstadoReserva,
  eliminarReserva
} = require('../controladores/controlador_reservas');

enrutador.get('/', obtenerReservas);
enrutador.get('/:id', obtenerReservaPorId);
enrutador.post('/', crearReserva);
enrutador.put('/:id', actualizarReserva);
enrutador.put('/:id/estado', cambiarEstadoReserva);
enrutador.delete('/:id', eliminarReserva);

module.exports = enrutador;