const conexion = require('../config/conexion');

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
        a.accion AS descripcion
      FROM auditoria a
      LEFT JOIN usuario u ON a.id_usuario = u.id_usuario
      ORDER BY a.id_auditoria DESC;
    `;
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows || []);
  } catch (error) {
    console.error('Error al obtener auditoría:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar la bitácora de auditoría.' });
  }
};

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