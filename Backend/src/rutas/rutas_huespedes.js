const express = require('express');
const enrutador = express.Router();
const {
  obtenerHuespedes,
  obtenerReporteHuespedes,
  obtenerHuespedPorId,
  crearHuesped,
  actualizarHuesped,
  cambiarEstadoHuesped,
  enviarReporteHuespedesCorreo,
  eliminarHuesped
} = require('../controladores/controlador_huespedes');

// Definición de Endpoints
enrutador.get('/', obtenerHuespedes);
enrutador.get('/reporte/excel', obtenerReporteHuespedes);
enrutador.get('/:id', obtenerHuespedPorId);
enrutador.post('/', crearHuesped);
enrutador.put('/:id', actualizarHuesped);
enrutador.patch('/:id/estado', cambiarEstadoHuesped);
enrutador.delete('/:id', eliminarHuesped);
enrutador.post('/reporte/correo', enviarReporteHuespedesCorreo);

module.exports = enrutador;