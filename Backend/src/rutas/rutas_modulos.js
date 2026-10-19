const { Router } = require('express');
const router = Router();
const { obtenerModulosConFunciones } = require('../controladores/controlador_modulos');

router.get('/', obtenerModulosConFunciones);

module.exports = router;