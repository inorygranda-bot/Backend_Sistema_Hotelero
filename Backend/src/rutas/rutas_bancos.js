const express = require('express');
const enrutador = express.Router();
const { obtenerBancos, crearBanco, eliminarBanco } = require('../controladores/controlador_bancos');

enrutador.get('/', obtenerBancos);
enrutador.post('/', crearBanco);
enrutador.delete('/:id', eliminarBanco);

module.exports = enrutador;