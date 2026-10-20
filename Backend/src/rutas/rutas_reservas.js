const express = require('express');
const enrutador = express.Router();
const {
  obtenerReservas,
  obtenerReservaPorId,
  crearReserva,
  actualizarReserva,
  cambiarEstadoReserva,
  eliminarReserva,
  obtenerReservasTelegram,
  crearReservaTelegram,
  enviarNotificacionTelegram
} = require('../controladores/controlador_reservas');

enrutador.get('/', obtenerReservas);
enrutador.post('/', crearReserva);

enrutador.get('/telegram', obtenerReservasTelegram);
enrutador.post('/telegram', crearReservaTelegram);
enrutador.post('/telegram/:id/notificar', enviarNotificacionTelegram);

enrutador.get('/:id', obtenerReservaPorId);
enrutador.put('/:id', actualizarReserva);
enrutador.put('/:id/estado', cambiarEstadoReserva);
enrutador.delete('/:id', eliminarReserva);

module.exports = enrutador;