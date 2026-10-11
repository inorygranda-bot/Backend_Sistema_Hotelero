const express = require('express');
const enrutador = express.Router();
const { obtenerModulosConFunciones } = require('../controladores/controlador_modulos');

enrutador.get('/', obtenerModulosConFunciones);

module.exports = enrutador;