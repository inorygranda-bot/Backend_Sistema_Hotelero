const conexion = require('../config/conexion');

const obtenerAuditoria = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        a.id_auditoria,
        a.id_usuario,
        COALESCE(u.nombre, 'Sistema / Desconocido') AS nombre_usuario,
        COALESCE(u.correo, 'N/A') AS correo_usuario,
        a.id_modulo,
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

const registrarAuditoria = async (id_usuario, id_modulo, accion) => {
  try {
    const usuarioValido = (id_usuario && !isNaN(parseInt(id_usuario))) ? parseInt(id_usuario) : 1;
    // Si id_modulo llega como texto o número, lo manejamos de forma segura (8 es Control de Emergencia)
    let moduloValido = 8;
    if (id_modulo && !isNaN(parseInt(id_modulo))) {
      moduloValido = parseInt(id_modulo);
    }

    const consultaSQL = `
      INSERT INTO auditoria (id_usuario, id_modulo, accion)
      VALUES ($1, $2, $3);
    `;
    await conexion.query(consultaSQL, [usuarioValido, moduloValido, accion]);
  } catch (error) {
    console.error('Error al registrar evento en auditoría:', error);
  }
};

module.exports = {
  obtenerAuditoria,
  registrarAuditoria
};