const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');

const obtenerTiposHabitacion = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT id_tipo_habitacion, nombre_tipo, descripcion 
      FROM tipo_habitacion 
      ORDER BY id_tipo_habitacion ASC;
    `;
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener tipos de habitación:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar los tipos de habitación.' });
  }
};

const crearTipoHabitacion = async (peticion, respuesta) => {
  const { nombre_tipo, descripcion } = peticion.body;

  if (!nombre_tipo || !descripcion) {
    return respuesta.status(400).json({ mensaje: 'El nombre y la descripción son obligatorios.' });
  }

  try {
    const consultaSQL = `
      INSERT INTO tipo_habitacion (nombre_tipo, descripcion)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const resultado = await conexion.query(consultaSQL, [nombre_tipo.trim(), descripcion.trim()]);
    const tipoCreado = resultado.rows[0];

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || peticion.body.id_admin || 1;

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Habitaciones', 
      `Registró el nuevo tipo de habitación: ${tipoCreado.nombre_tipo} (Descripción: ${tipoCreado.descripcion})`
    );

    return respuesta.status(201).json({
      mensaje: 'Tipo de habitación registrado exitosamente.',
      tipo: tipoCreado
    });
  } catch (error) {
    console.error('Error al crear tipo de habitación:', error);
    if (error.code === '23505') {
      return respuesta.status(400).json({ mensaje: 'Ya existe un tipo de habitación con ese nombre.' });
    }
    return respuesta.status(500).json({ mensaje: 'Error interno al registrar el tipo de habitación.' });
  }
};

const actualizarTipoHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { nombre_tipo, descripcion } = peticion.body;

  if (!nombre_tipo || !descripcion) {
    return respuesta.status(400).json({ mensaje: 'El nombre y la descripción son obligatorios.' });
  }

  try {
    const consultaPrev = `
      SELECT * FROM tipo_habitacion WHERE id_tipo_habitacion = $1;
    `;
    const resultadoPrev = await conexion.query(consultaPrev, [id]);

    if (resultadoPrev.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'El tipo de habitación no existe.' });
    }

    const tipoAnterior = resultadoPrev.rows[0];

    const consultaSQL = `
      UPDATE tipo_habitacion
      SET nombre_tipo = $1, descripcion = $2
      WHERE id_tipo_habitacion = $3
      RETURNING *;
    `;
    const resultado = await conexion.query(consultaSQL, [nombre_tipo.trim(), descripcion.trim(), id]);
    const tipoActualizado = resultado.rows[0];

    let cambios = [];
    if (tipoAnterior.nombre_tipo !== nombre_tipo.trim()) {
      cambios.push(`nombre de "${tipoAnterior.nombre_tipo}" a "${nombre_tipo.trim()}"`);
    }
    if (tipoAnterior.descripcion !== descripcion.trim()) {
      cambios.push(`descripción de "${tipoAnterior.descripcion}" a "${descripcion.trim()}"`);
    }

    const detalleModificacion = cambios.length > 0 ? cambios.join(', ') : 'actualizó los datos sin cambios notables';
    const descripcionAuditoria = `Actualizó el tipo de habitación ${tipoAnterior.nombre_tipo}: modificó ${detalleModificacion}.`;

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || peticion.body.id_admin || 1;

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Habitaciones', 
      descripcionAuditoria
    );

    return respuesta.status(200).json({
      mensaje: 'Tipo de habitación actualizado correctamente.',
      tipo: tipoActualizado
    });
  } catch (error) {
    console.error(`Error al actualizar tipo de habitación:`, error);
    if (error.code === '23505') {
      return respuesta.status(400).json({ mensaje: 'Ya existe otro tipo de habitación con ese nombre.' });
    }
    return respuesta.status(500).json({ mensaje: 'Error al actualizar el tipo de habitación.' });
  }
};

const eliminarTipoHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;

  try {
    const consultaPrev = await conexion.query('SELECT nombre_tipo, descripcion FROM tipo_habitacion WHERE id_tipo_habitacion = $1', [id]);
    const infoTipo = consultaPrev.rows[0];

    const consultaSQL = `
      DELETE FROM tipo_habitacion
      WHERE id_tipo_habitacion = $1
      RETURNING *;
    `;
    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'El tipo de habitación no existe.' });
    }

    const nombreEliminado = infoTipo ? `${infoTipo.nombre_tipo}` : 'un tipo de habitación';
    
    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || peticion.body.id_admin || 1;

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Habitaciones', 
      `Eliminó permanentemente el tipo de habitación: ${nombreEliminado}`
    );

    return respuesta.status(200).json({
      mensaje: 'Tipo de habitación eliminado correctamente.',
      tipo: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error al eliminar tipo de habitación:`, error);
    if (error.code === '23503') {
      return respuesta.status(400).json({
        mensaje: 'No se puede eliminar este tipo porque hay habitaciones asociadas a él.'
      });
    }
    return respuesta.status(500).json({ mensaje: 'Error al intentar eliminar el tipo de habitación.' });
  }
};

module.exports = {
  obtenerTiposHabitacion,
  crearTipoHabitacion,
  actualizarTipoHabitacion,
  eliminarTipoHabitacion
};