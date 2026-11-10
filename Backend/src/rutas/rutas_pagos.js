const express = require('express');
const enrutador = express.Router();
const {
  obtenerPagos,
  obtenerPagoPorId,
  crearPago,
  enviarReportePagosCorreo,
  eliminarPago
} = require('../controladores/controlador_pagos');

enrutador.get('/', obtenerPagos);
enrutador.get('/:id', obtenerPagoPorId);
enrutador.post('/', crearPago);
enrutador.post('/reporte', enviarReportePagosCorreo);
enrutador.delete('/:id', eliminarPago);
enrutador.post('/reporte/correo', enviarReportePagosCorreo);

module.exports = enrutador;