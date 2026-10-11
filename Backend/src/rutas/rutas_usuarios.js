const express = require('express');
const enrutador = express.Router();
const {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  iniciarSesion
} = require('../controladores/controlador_usuarios');

enrutador.get('/', obtenerUsuarios);
enrutador.get('/:id', obtenerUsuarioPorId);
enrutador.post('/', crearUsuario);
enrutador.post('/login', iniciarSesion);
enrutador.put('/:id', actualizarUsuario);
enrutador.delete('/:id', eliminarUsuario);

module.exports = enrutador;