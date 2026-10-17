const express = require('express');
const enrutador = express.Router();
const { obtenerAuditoria } = require('../controladores/controlador_auditoria');

// Endpoint para obtener toda la trazabilidad de auditoría
enrutador.get('/', obtenerAuditoria);

module.exports = enrutador;