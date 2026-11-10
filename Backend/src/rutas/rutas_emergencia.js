const express = require('express');
const router = express.Router();
const {
  obtenerHuespedesActivosEmergencia,
  obtenerEstadoEmergencia,
  activarEmergencia,
  desactivarEmergencia,
  enviarMensajeMasivoAlerta,
  enviarReporteEmergenciaCorreo,
  registrarMarcajeHuespedSeguro 
} = require('../controladores/controlador_emergencia');

router.get('/activos', obtenerHuespedesActivosEmergencia);
router.get('/estado', obtenerEstadoEmergencia);
router.post('/activar', activarEmergencia);
router.post('/desactivar', desactivarEmergencia);
router.post('/mensaje-masivo', enviarMensajeMasivoAlerta);
router.post('/marcar-seguro', registrarMarcajeHuespedSeguro); 
router.post('/reporte/correo', enviarReporteEmergenciaCorreo);

module.exports = router;