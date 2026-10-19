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
  const { nombre_tipo, descripcion, precio_base } = peticion.body;

  if (!nombre_tipo || !descripcion) {
    return respuesta.status(400).json({ mensaje: 'El nombre y la descripción son obligatorios.' });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    // 1. Insertar el tipo de habitación
    const consultaTipo = `
      INSERT INTO tipo_habitacion (nombre_tipo, descripcion)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const resultadoTipo = await cliente.query(consultaTipo, [nombre_tipo.trim(), descripcion.trim()]);
    const tipoCreado = resultadoTipo.rows[0];

    // 2. Asegurar que exista la temporada por defecto "Temporada normal"
    await cliente.query(`
      INSERT INTO temporada (nombre_temporada, fecha_inicio, fecha_fin, descripcion)
      VALUES ('Temporada normal', 'N/A', 'N/A', 'Tarifa base para la habitacion')
      ON CONFLICT (nombre_temporada) DO NOTHING;
    `);

    const temporadaRes = await cliente.query(
      `SELECT id_temporada FROM temporada WHERE nombre_temporada = 'Temporada normal' LIMIT 1;`
    );
    const idTemporadaNormal = temporadaRes.rows[0]?.id_temporada;

    // 3. Crear una Tarifa Base inicial vinculada automáticamente
    const precioInicial = parseFloat(precio_base) || 100.00;
    const consultaTarifa = `
      INSERT INTO tarifa (nombre_tarifa, ocupacion_base, incluye, precio_base, estado, iva, huesped_adicional)
      VALUES ($1, 2, 'Tarifa base predeterminada', $2, 'Activa', 16, 15)
      RETURNING id_tarifa;
    `;
    const resultadoTarifa = await cliente.query(consultaTarifa, [
      `Tarifa Base - ${tipoCreado.nombre_tipo}`,
      precioInicial
    ]);
    const idNuevaTarifa = resultadoTarifa.rows[0].id_tarifa;

    // 4. Vincular tarifa con la temporada normal y el tipo de habitación
    if (idTemporadaNormal) {
      await cliente.query(`
        INSERT INTO tarifa_temporada (id_tarifa, id_temporada)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [idNuevaTarifa, idTemporadaNormal]);
    }

    await cliente.query(`
      INSERT INTO tarifa_hab (id_tarifa, id_tipo_hab)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING;
    `, [idNuevaTarifa, tipoCreado.id_tipo_habitacion]);

    await cliente.query('COMMIT');

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(
      idUsuarioResponsable, 
      'Habitaciones', 
      `Registró el nuevo tipo de habitación "${tipoCreado.nombre_tipo}" con tarifa base de $${precioInicial.toFixed(2)}`
    );

    return respuesta.status(201).json({
      mensaje: 'Tipo de habitación y tarifa base registrados exitosamente.',
      tipo: tipoCreado
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al crear tipo de habitación:', error);
    if (error.code === '23505') {
      return respuesta.status(400).json({ mensaje: 'Ya existe un tipo de habitación con ese nombre.' });
    }
    return respuesta.status(500).json({ mensaje: 'Error interno al registrar el tipo de habitación.' });
  } finally {
    cliente.release();
  }
};

const actualizarTipoHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { nombre_tipo, descripcion } = peticion.body;

  if (!nombre_tipo || !descripcion) {
    return respuesta.status(400).json({ mensaje: 'El nombre y la descripción son obligatorios.' });
  }

  try {
    const consultaPrev = `SELECT * FROM tipo_habitacion WHERE id_tipo_habitacion = $1;`;
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

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(idUsuarioResponsable, 'Habitaciones', `Actualizó el tipo de habitación ${tipoAnterior.nombre_tipo}`);

    return respuesta.status(200).json({
      mensaje: 'Tipo de habitación actualizado correctamente.',
      tipo: tipoActualizado
    });
  } catch (error) {
    console.error(`Error al actualizar tipo de habitación:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al actualizar el tipo de habitación.' });
  }
};

const eliminarTipoHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;

  try {
    const consultaSQL = `DELETE FROM tipo_habitacion WHERE id_tipo_habitacion = $1 RETURNING *;`;
    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'El tipo de habitación no existe.' });
    }

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(idUsuarioResponsable, 'Habitaciones', `Eliminó el tipo de habitación ID ${id}`);

    return respuesta.status(200).json({ mensaje: 'Tipo de habitación eliminado correctamente.' });
  } catch (error) {
    console.error(`Error al eliminar tipo de habitación:`, error);
    if (error.code === '23503') {
      return respuesta.status(400).json({ mensaje: 'No se puede eliminar este tipo porque hay habitaciones asociadas a él.' });
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