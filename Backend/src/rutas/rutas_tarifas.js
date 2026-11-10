const express = require('express');
const router = express.Router();
const {
  obtenerTarifas,
  obtenerTiposHabitacion,
  obtenerTemporadas,
  crearTemporada,
  crearTarifa,
  actualizarTarifa,
  eliminarTarifa,
  duplicarTarifa,
  enviarReporteTarifasCorreo,
  obtenerTasaBCV
} = require('../controladores/controlador_tarifas');

// Endpoints correctamente enlazados
router.get('/tipos-habitacion', obtenerTiposHabitacion);
router.get('/temporadas', obtenerTemporadas);
router.post('/temporadas', crearTemporada);
router.get('/tasa-bcv', obtenerTasaBCV);
router.get('/', obtenerTarifas);
router.post('/', crearTarifa);
router.put('/:id', actualizarTarifa);
router.delete('/:id', eliminarTarifa);
router.post('/:id/duplicar', duplicarTarifa);
router.post('/reporte/correo', enviarReporteTarifasCorreo);

module.exports = router;