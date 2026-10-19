const express = require('express');
const router = express.Router();
const {
  obtenerHuespedesActivosEmergencia,
  obtenerEstadoEmergencia,
  activarEmergencia,
  desactivarEmergencia,
  enviarMensajeMasivoAlerta,
  registrarMarcajeHuespedSeguro 
} = require('../controladores/controlador_emergencia');

router.get('/activos', obtenerHuespedesActivosEmergencia);
router.get('/estado', obtenerEstadoEmergencia);
router.post('/activar', activarEmergencia);
router.post('/desactivar', desactivarEmergencia);
router.post('/mensaje-masivo', enviarMensajeMasivoAlerta);
router.post('/marcar-seguro', registrarMarcajeHuespedSeguro); 

module.exports = router;