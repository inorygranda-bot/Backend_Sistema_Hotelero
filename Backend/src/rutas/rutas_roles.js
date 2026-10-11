const express = require('express');
const enrutador = express.Router();
const {
  obtenerRoles,
  obtenerRolPorId,
  crearRol,
  actualizarRol,
  eliminarRol
} = require('../controladores/controlador_roles');

enrutador.get('/', obtenerRoles);
enrutador.get('/:id', obtenerRolPorId);
enrutador.post('/', crearRol);
enrutador.put('/:id', actualizarRol);
enrutador.delete('/:id', eliminarRol);

module.exports = enrutador;