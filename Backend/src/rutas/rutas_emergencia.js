const express = require('express');
const enrutador = express.Router();
const {
  obtenerHuespedesActivosEmergencia,
  activarEmergencia,
  enviarMensajeMasivoAlerta
} = require('../controladores/controlador_emergencia');

// Definición de Endpoints del Módulo de Control de Emergencia
enrutador.get('/activos', obtenerHuespedesActivosEmergencia);
enrutador.post('/activar', activarEmergencia);
enrutador.post('/mensaje-masivo', enviarMensajeMasivoAlerta);

module.exports = enrutador;