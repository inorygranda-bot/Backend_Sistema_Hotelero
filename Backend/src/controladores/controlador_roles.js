const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');

const obtenerRoles = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        r.id_rol, 
        r.nombre, 
        r.descripcion,
        COALESCE(
          (SELECT json_agg(rm.id_modulo) FROM rol_modulo rm WHERE rm.id_rol = r.id_rol), 
          '[]'
        ) AS modulos_asignados,
        COALESCE(
          (SELECT json_agg(rf.id_funcion) FROM rol_funcion rf WHERE rf.id_rol = r.id_rol), 
          '[]'
        ) AS funciones_asignadas
      FROM rol r 
      ORDER BY r.id_rol ASC;
    `;
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener los roles:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar la lista de roles.' });
  }
};

const obtenerRolPorId = async (peticion, respuesta) => {
  const { id } = peticion.params;
  try {
    const consultaSQL = `
      SELECT id_rol, nombre, descripcion 
      FROM rol 
      WHERE id_rol = $1;
    `;
    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Rol no encontrado.' });
    }

    return respuesta.status(200).json(resultado.rows[0]);
  } catch (error) {
    console.error(`Error al obtener el rol ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al obtener los datos del rol.' });
  }
};

const crearRol = async (peticion, respuesta) => {
  const { nombre, descripcion, modulos = [], funciones = [] } = peticion.body;

  if (!nombre || !descripcion) {
    return respuesta.status(400).json({ mensaje: 'El nombre y la descripción del rol son obligatorios.' });
  }

  const cliente = await conexion.connect();
  try {
    await cliente.query('BEGIN');

    const insertRol = `
      INSERT INTO rol (nombre, descripcion)
      VALUES ($1, $2)
      RETURNING id_rol;
    `;
    const resRol = await cliente.query(insertRol, [nombre.trim(), descripcion.trim()]);
    const idRol = resRol.rows[0].id_rol;

    for (const idModulo of modulos) {
      await cliente.query(
        'INSERT INTO rol_modulo (id_rol, id_modulo, acceso) VALUES ($1, $2, $3)',
        [idRol, idModulo, 'TOTAL']
      );
    }

    for (const idFuncion of funciones) {
      await cliente.query(
        'INSERT INTO rol_funcion (id_rol, id_funcion, acceso) VALUES ($1, $2, $3)',
        [idRol, idFuncion, 'TOTAL']
      );
    }

    await cliente.query('COMMIT');

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(
      idUsuarioResponsable, 
      'Rol y Usuarios', 
      `Creó el rol "${nombre.trim()}" con descripción "${descripcion.trim()}" y ${modulos.length} módulos asignados.`
    );

    return respuesta.status(201).json({ mensaje: 'Rol registrado exitosamente con sus permisos.' });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al registrar rol:', error);
    return respuesta.status(500).json({ mensaje: 'Error interno al intentar guardar el rol.' });
  } finally {
    cliente.release();
  }
};

const actualizarRol = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { nombre, descripcion, modulos = [], funciones = [] } = peticion.body;

  if (!nombre || !descripcion) {
    return respuesta.status(400).json({ mensaje: 'Por favor complete todos los campos requeridos.' });
  }

  const cliente = await conexion.connect();
  try {
    await cliente.query('BEGIN');

    // Obtener datos anteriores para auditoría detallada sin IDs
    const rolAnteriorRes = await cliente.query('SELECT nombre, descripcion FROM rol WHERE id_rol = $1', [id]);
    if (rolAnteriorRes.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'El rol a actualizar no existe.' });
    }
    const rolAnterior = rolAnteriorRes.rows[0];

    const updateRol = `
      UPDATE rol
      SET nombre = $1, descripcion = $2
      WHERE id_rol = $3
      RETURNING id_rol;
    `;
    const resRol = await cliente.query(updateRol, [nombre.trim(), descripcion.trim(), id]);

    await cliente.query('DELETE FROM rol_modulo WHERE id_rol = $1', [id]);
    await cliente.query('DELETE FROM rol_funcion WHERE id_rol = $1', [id]);

    for (const idModulo of modulos) {
      await cliente.query(
        'INSERT INTO rol_modulo (id_rol, id_modulo, acceso) VALUES ($1, $2, $3)',
        [id, idModulo, 'TOTAL']
      );
    }

    for (const idFuncion of funciones) {
      await cliente.query(
        'INSERT INTO rol_funcion (id_rol, id_funcion, acceso) VALUES ($1, $2, $3)',
        [id, idFuncion, 'TOTAL']
      );
    }

    await cliente.query('COMMIT');

    let cambios = [];
    if (rolAnterior.nombre !== nombre.trim()) {
      cambios.push(`nombre de "${rolAnterior.nombre}" a "${nombre.trim()}"`);
    }
    if (rolAnterior.descripcion !== descripcion.trim()) {
      cambios.push(`descripción modificada`);
    }
    cambios.push(`se actualizaron sus módulos y permisos asociados (${modulos.length} módulos)`);

    const detalleModificacion = cambios.join(', ');
    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Rol y Usuarios', 
      `Actualizó el rol "${rolAnterior.nombre}": ${detalleModificacion}.`
    );

    return respuesta.status(200).json({ mensaje: 'Rol y permisos actualizados correctamente.' });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al actualizar el rol ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al actualizar el rol.' });
  } finally {
    cliente.release();
  }
};

const eliminarRol = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const cliente = await conexion.connect();
  try {
    await cliente.query('BEGIN');

    const rolInfoRes = await cliente.query('SELECT nombre FROM rol WHERE id_rol = $1', [id]);
    const nombreRolEliminado = rolInfoRes.rows.length > 0 ? rolInfoRes.rows[0].nombre : 'un rol';

    await cliente.query('DELETE FROM rol_modulo WHERE id_rol = $1', [id]);
    await cliente.query('DELETE FROM rol_funcion WHERE id_rol = $1', [id]);
    const resRol = await cliente.query('DELETE FROM rol WHERE id_rol = $1 RETURNING *;', [id]);

    if (resRol.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'El rol a eliminar no existe.' });
    }

    await cliente.query('COMMIT');

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(
      idUsuarioResponsable, 
      'Rol y Usuarios', 
      `Eliminó permanentemente el rol del sistema "${nombreRolEliminado}".`
    );

    return respuesta.status(200).json({ mensaje: 'Rol eliminado correctamente.' });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al eliminar el rol ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al intentar eliminar el rol.' });
  } finally {
    cliente.release();
  }
};

module.exports = {
  obtenerRoles,
  obtenerRolPorId,
  crearRol,
  actualizarRol,
  eliminarRol
};