const express = require('express');
const enrutador = express.Router();
const {
  obtenerRecargos,
  obtenerRecargoPorId,
  crearRecargo,
  actualizarRecargo,
  eliminarRecargo
} = require('../controladores/controlador_recargos');

enrutador.get('/', obtenerRecargos);
enrutador.get('/:id', obtenerRecargoPorId);
enrutador.post('/', crearRecargo);
enrutador.put('/:id', actualizarRecargo);
enrutador.delete('/:id', eliminarRecargo);

module.exports = enrutador;