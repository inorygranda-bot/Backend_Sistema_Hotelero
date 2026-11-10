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
  enviarNotificacionTelegram,
  obtenerReporteReservas,
  enviarReporteReservasCorreo,
  realizarCheckinReserva
} = require('../controladores/controlador_reservas');

enrutador.get('/', obtenerReservas);
enrutador.post('/', crearReserva);

enrutador.get('/reporte/excel', obtenerReporteReservas);
enrutador.post('/reporte/correo', enviarReporteReservasCorreo);

enrutador.get('/telegram/listar', obtenerReservasTelegram);
enrutador.post('/telegram/crear', crearReservaTelegram);
enrutador.post('/telegram/notificar', enviarNotificacionTelegram);

enrutador.get('/:id', obtenerReservaPorId);
enrutador.put('/:id', actualizarReserva);
enrutador.patch('/:id/estado', cambiarEstadoReserva);
enrutador.delete('/:id', eliminarReserva);
enrutador.post('/:id/checkin', realizarCheckinReserva);

module.exports = enrutador;