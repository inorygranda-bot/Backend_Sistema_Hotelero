const express = require('express');
const router = express.Router();
const {
  obtenerTarifas,
  obtenerTarifaPorId,
  obtenerTiposHabitacion,
  crearTarifa,
  actualizarTarifa,
  eliminarTarifa,
  duplicarTarifa,
  obtenerTasaBCV
} = require('../controladores/controlador_tarifas');

// Rutas de tipos de habitación y tasa BCV (deben ir antes de :id)
router.get('/tipos-habitacion', obtenerTiposHabitacion);
router.get('/tasa-bcv', obtenerTasaBCV);

// Rutas CRUD de Tarifas
router.get('/', obtenerTarifas);
router.get('/:id', obtenerTarifaPorId);
router.post('/', crearTarifa);
router.put('/:id', actualizarTarifa);
router.delete('/:id', eliminarTarifa);
router.post('/:id/duplicar', duplicarTarifa);

module.exports = router;
