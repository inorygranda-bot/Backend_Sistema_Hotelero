const express = require('express');
const router = express.Router();
const { 
  obtenerTemporadas, 
  crearTemporada,  // <--- Asegúrate de importar esto
  actualizarTemporada, 
  eliminarTemporada, 
  guardarCalendarioTemporadas 
} = require('../controladores/controlador_temporadas');

router.get('/', obtenerTemporadas);
router.post('/', crearTemporada); 
router.put('/:id', actualizarTemporada);
router.delete('/:id', eliminarTemporada);
router.post('/calendario-masivo', guardarCalendarioTemporadas);

module.exports = router;