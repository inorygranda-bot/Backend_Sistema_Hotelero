const conexion = require('../config/conexion');

// Obtener registros de auditoría para la vista del frontend
const obtenerAuditoria = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        a.id_auditoria,
        a.id_usuario,
        COALESCE(u.nombre, 'Sistema / Desconocido') AS nombre_usuario,
        COALESCE(u.correo, 'N/A') AS correo_usuario,
        a.modulo,
        a.fecha_hora AS fecha_accion,
        a.accion AS descripcion,
        CASE 
          WHEN a.accion ILIKE '%crear%' OR a.accion ILIKE '%registrar%' OR a.accion ILIKE '%registró%' THEN 'CREAR'
          WHEN a.accion ILIKE '%actualizar%' OR a.accion ILIKE '%modificar%' OR a.accion ILIKE '%cambiar%' THEN 'ACTUALIZAR'
          WHEN a.accion ILIKE '%eliminar%' OR a.accion ILIKE '%borrar%' THEN 'ELIMINAR'
          WHEN a.accion ILIKE '%sesión%' OR a.accion ILIKE '%acceso%' OR a.accion ILIKE '%login%' THEN 'ACCESO'
          ELSE 'ALERTA'
        END AS tipo_accion
      FROM auditoria a
      LEFT JOIN usuario u ON a.id_usuario = u.id_usuario
      ORDER BY a.id_auditoria DESC;
    `;
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener auditoría:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar la bitácora de auditoría.' });
  }
};

// Función modular reutilizable para insertar en la tabla auditoria de la base de datos
const registrarAuditoria = async (id_usuario, modulo, accion) => {
  try {
    const usuarioValido = id_usuario ? parseInt(id_usuario) : 1;
    const consultaSQL = `
      INSERT INTO auditoria (id_usuario, modulo, accion)
      VALUES ($1, $2, $3);
    `;
    await conexion.query(consultaSQL, [usuarioValido, modulo, accion]);
  } catch (error) {
    console.error('Error al registrar evento en auditoría:', error);
  }
};

module.exports = {
  obtenerAuditoria,
  registrarAuditoria
};