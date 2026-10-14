const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria'); // 1. Importar la función aquí arriba

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

    // 2. AQUÍ VA: Cuando la transacción de creación finaliza con éxito
    await registrarAuditoria(peticion.body.id_usuario || 1, 'Rol y Usuarios', `Creó el rol: ${nombre.trim()} (ID ${idRol})`);

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

    const updateRol = `
      UPDATE rol
      SET nombre = $1, descripcion = $2
      WHERE id_rol = $3
      RETURNING id_rol;
    `;
    const resRol = await cliente.query(updateRol, [nombre.trim(), descripcion.trim(), id]);

    if (resRol.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'El rol a actualizar no existe.' });
    }

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

    // 3. AQUÍ VA: Cuando la transacción de actualización finaliza con éxito
    await registrarAuditoria(peticion.body.id_usuario || 1, 'Rol y Usuarios', `Actualizó los permisos y datos del rol ID ${id}`);

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
    await cliente.query('DELETE FROM rol_modulo WHERE id_rol = $1', [id]);
    await cliente.query('DELETE FROM rol_funcion WHERE id_rol = $1', [id]);
    const resRol = await cliente.query('DELETE FROM rol WHERE id_rol = $1 RETURNING *;', [id]);

    if (resRol.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'El rol a eliminar no existe.' });
    }

    await cliente.query('COMMIT');

    // 4. AQUÍ VA: Cuando la transacción de eliminación finaliza con éxito
    await registrarAuditoria(peticion.body.id_usuario || 1, 'Rol y Usuarios', `Eliminó el rol ID ${id}`);

    return respuesta.status(200).json({ mensaje: 'Rol eliminado correctamente.' });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al eliminar el rol ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al intentar eliminar el rol.' });
  }
};

module.exports = {
  obtenerRoles,
  obtenerRolPorId,
  crearRol,
  actualizarRol,
  eliminarRol
};