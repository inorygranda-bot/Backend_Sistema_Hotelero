const express = require('express');
const enrutador = express.Router();
const {
  obtenerPagos,
  obtenerPagoPorId,
  crearPago,
  eliminarPago
} = require('../controladores/controlador_pagos');

enrutador.get('/', obtenerPagos);
enrutador.get('/:id', obtenerPagoPorId);
enrutador.post('/', crearPago);
enrutador.delete('/:id', eliminarPago);

module.exports = enrutador;