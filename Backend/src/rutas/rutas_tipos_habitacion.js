const express = require('express');
const enrutador = express.Router();
const {
  obtenerTiposHabitacion,
  crearTipoHabitacion,
  actualizarTipoHabitacion,
  eliminarTipoHabitacion
} = require('../controladores/controlador_tipos_habitacion');

enrutador.get('/', obtenerTiposHabitacion);
enrutador.post('/', crearTipoHabitacion);
enrutador.put('/:id', actualizarTipoHabitacion);
enrutador.delete('/:id', eliminarTipoHabitacion);

module.exports = enrutador;