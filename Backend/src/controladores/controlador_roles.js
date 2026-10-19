const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');

const obtenerRoles = async (peticion, respuesta) => {
  try {
    const resRoles = await conexion.query('SELECT * FROM rol ORDER BY id_rol ASC;');
    const roles = resRoles.rows;

    for (let rol of roles) {
      try {
        const resFunciones = await conexion.query(
          'SELECT id_funcion FROM rol_funcion WHERE id_rol = $1;',
          [rol.id_rol]
        );
        rol.funciones_asignadas = resFunciones.rows.map(f => f.id_funcion);

        const resModulos = await conexion.query(`
          SELECT DISTINCT f.id_modulo 
          FROM rol_funcion rf 
          JOIN funcion f ON rf.id_funcion = f.id_funcion 
          WHERE rf.id_rol = $1;
        `, [rol.id_rol]);
        rol.modulos_asignados = resModulos.rows.map(m => m.id_modulo);
      } catch (errInterno) {
        rol.funciones_asignadas = [];
        rol.modulos_asignados = [];
      }
    }

    return respuesta.status(200).json(roles);
  } catch (error) {
    console.error('Error al obtener roles:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar los roles.' });
  }
};

const obtenerRolPorId = async (peticion, respuesta) => {
  const { id } = peticion.params;
  try {
    const resultado = await conexion.query('SELECT * FROM rol WHERE id_rol = $1;', [id]);
    if (resultado.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Rol no encontrado.' });
    }
    const rol = resultado.rows[0];
    
    const resFunciones = await conexion.query('SELECT id_funcion FROM rol_funcion WHERE id_rol = $1;', [id]);
    rol.funciones_asignadas = resFunciones.rows.map(f => f.id_funcion);

    return respuesta.status(200).json(rol);
  } catch (error) {
    console.error('Error al obtener el rol:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar el rol.' });
  }
};

const crearRol = async (peticion, respuesta) => {
  const { nombre, descripcion, funciones, id_usuario } = peticion.body;

  if (!nombre || !descripcion) {
    return respuesta.status(400).json({ mensaje: 'El nombre y la descripción son obligatorios.' });
  }

  const cliente = await conexion.connect();
  try {
    await cliente.query('BEGIN');

    const resRol = await cliente.query(`
      INSERT INTO rol (nombre, descripcion) VALUES ($1, $2) RETURNING *;
    `, [nombre.trim(), descripcion.trim()]);

    const nuevoRol = resRol.rows[0];

    if (funciones && Array.isArray(funciones)) {
      for (const idFuncion of funciones) {
        await cliente.query(`
          INSERT INTO rol_funcion (id_rol, id_funcion, acceso) VALUES ($1, $2, 'TOTAL')
        `, [nuevoRol.id_rol, idFuncion]);
      }
    }

    await cliente.query('COMMIT');

    const idResponsable = id_usuario || 1;
    const respQuery = await conexion.query('SELECT nombre FROM usuario WHERE id_usuario = $1', [idResponsable]);
    const nombreResponsable = respQuery.rows[0]?.nombre || 'Administrador';

    await registrarAuditoria(
      idResponsable,
      9,
      `${nombreResponsable} creó el nuevo rol "${nuevoRol.nombre}" con su respectiva asignación de permisos.`
    );

    return respuesta.status(201).json({ mensaje: 'Rol creado exitosamente.', rol: nuevoRol });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al crear rol:', error);
    if (error.code === '23505') {
      return respuesta.status(400).json({ mensaje: 'Ya existe un rol con ese nombre.' });
    }
    return respuesta.status(500).json({ mensaje: 'Error al registrar el rol.' });
  } finally {
    cliente.release();
  }
};

const actualizarRol = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { nombre, descripcion, funciones, id_usuario } = peticion.body;

  if (!nombre || !descripcion) {
    return respuesta.status(400).json({ mensaje: 'El nombre y la descripción son obligatorios.' });
  }

  const cliente = await conexion.connect();
  try {
    await cliente.query('BEGIN');

    const rolPrev = await cliente.query('SELECT nombre FROM rol WHERE id_rol = $1', [id]);
    const nombreAnterior = rolPrev.rows[0]?.nombre || 'Rol';

    const resRol = await cliente.query(`
      UPDATE rol SET nombre = $1, descripcion = $2 WHERE id_rol = $3 RETURNING *;
    `, [nombre.trim(), descripcion.trim(), id]);

    if (resRol.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'El rol no existe.' });
    }

    await cliente.query('DELETE FROM rol_funcion WHERE id_rol = $1', [id]);

    if (funciones && Array.isArray(funciones)) {
      for (const idFuncion of funciones) {
        await cliente.query(`
          INSERT INTO rol_funcion (id_rol, id_funcion, acceso) VALUES ($1, $2, 'TOTAL')
        `, [id, idFuncion]);
      }
    }

    await cliente.query('COMMIT');

    const idResponsable = id_usuario || 1;
    const respQuery = await conexion.query('SELECT nombre FROM usuario WHERE id_usuario = $1', [idResponsable]);
    const nombreResponsable = respQuery.rows[0]?.nombre || 'Administrador';

    await registrarAuditoria(
      idResponsable,
      9,
      `${nombreResponsable} actualizó el rol "${nombreAnterior}" a "${nombre.trim()}" con sus permisos correspondientes.`
    );

    return respuesta.status(200).json({ mensaje: 'Rol actualizado exitosamente.', rol: resRol.rows[0] });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al actualizar rol:', error);
    return respuesta.status(500).json({ mensaje: 'Error al actualizar el rol.' });
  } finally {
    cliente.release();
  }
};

const eliminarRol = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const idResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

  const cliente = await conexion.connect();
  try {
    await cliente.query('BEGIN');

    const rolPrev = await cliente.query('SELECT nombre FROM rol WHERE id_rol = $1', [id]);
    if (rolPrev.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'El rol no existe.' });
    }
    const nombreRol = rolPrev.rows[0].nombre;

    await cliente.query('DELETE FROM rol_funcion WHERE id_rol = $1', [id]);
    const resultado = await cliente.query('DELETE FROM rol WHERE id_rol = $1 RETURNING *;', [id]);

    await cliente.query('COMMIT');

    const respQuery = await conexion.query('SELECT nombre FROM usuario WHERE id_usuario = $1', [idResponsable]);
    const nombreResponsable = respQuery.rows[0]?.nombre || 'Administrador';

    await registrarAuditoria(
      idResponsable,
      9,
      `${nombreResponsable} eliminó permanentemente el rol "${nombreRol}".`
    );

    return respuesta.status(200).json({ mensaje: 'Rol eliminado exitosamente.', rol: resultado.rows[0] });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al eliminar rol:', error);
    if (error.code === '23503') {
      return respuesta.status(400).json({ mensaje: 'No se puede eliminar el rol porque hay usuarios activos asignados a él.' });
    }
    return respuesta.status(500).json({ mensaje: 'Error al eliminar el rol.' });
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