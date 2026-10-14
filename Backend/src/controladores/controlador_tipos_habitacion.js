const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria'); // 1. Importar la función aquí arriba

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
    
    // 2. AQUÍ VA: Cuando se creó exitosamente el tipo de habitación
    await registrarAuditoria(peticion.body.id_usuario || 1, 'Habitaciones', `Registró el tipo de habitación: ${nombre_tipo.trim()}`);

    return respuesta.status(201).json({
      mensaje: 'Tipo de habitación registrado exitosamente.',
      tipo: resultado.rows[0]
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
    const consultaSQL = `
      UPDATE tipo_habitacion
      SET nombre_tipo = $1, descripcion = $2
      WHERE id_tipo_habitacion = $3
      RETURNING *;
    `;
    const resultado = await conexion.query(consultaSQL, [nombre_tipo.trim(), descripcion.trim(), id]);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'El tipo de habitación no existe.' });
    }

    // 3. AQUÍ VA: Cuando la actualización fue exitosa y verificamos que el ID existe
    await registrarAuditoria(peticion.body.id_usuario || 1, 'Habitaciones', `Actualizó el tipo de habitación ID ${id}`);

    return respuesta.status(200).json({
      mensaje: 'Tipo de habitación actualizado correctamente.',
      tipo: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error al actualizar tipo de habitación ID ${id}:`, error);
    if (error.code === '23505') {
      return respuesta.status(400).json({ mensaje: 'Ya existe otro tipo de habitación con ese nombre.' });
    }
    return respuesta.status(500).json({ mensaje: 'Error al actualizar el tipo de habitación.' });
  }
};

const eliminarTipoHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;

  try {
    const consultaSQL = `
      DELETE FROM tipo_habitacion
      WHERE id_tipo_habitacion = $1
      RETURNING *;
    `;
    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'El tipo de habitación no existe.' });
    }

    // 4. AQUÍ VA: Cuando se eliminó correctamente el registro
    await registrarAuditoria(peticion.body.id_usuario || 1, 'Habitaciones', `Eliminó el tipo de habitación ID ${id}`);

    return respuesta.status(200).json({
      mensaje: 'Tipo de habitación eliminado correctamente.',
      tipo: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error al eliminar tipo de habitación ID ${id}:`, error);
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