const express = require('express');
const enrutador = express.Router();
const { procesarMensajeChavoo } = require('../controladores/controlador_chavoo');

enrutador.post('/', procesarMensajeChavoo);

module.exports = enrutador;