const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');

const eliminarHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;

  try {
    const consultaSQL = `
      DELETE FROM habitacion
      WHERE codigo_habitacion = $1
      RETURNING *;
    `;

    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'La habitación a eliminar no existe.' });
    }

    // ✅ REGISTRAR AUDITORÍA AQUÍ (Cuando el ID está validado y la eliminación fue exitosa)
    await registrarAuditoria(peticion.body.id_usuario || 1, 'Habitaciones', `Eliminó la habitación N° ${id}`);

    return respuesta.status(200).json({
      mensaje: 'Habitación eliminada correctamente.',
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error al eliminar la habitación ID ${id}:`, error);

    if (error.code === '23503') {
      return respuesta.status(400).json({
        mensaje: 'No se puede eliminar la habitación porque tiene reservas o registros asociados.'
      });
    }

    return respuesta.status(500).json({ mensaje: 'Error al intentar eliminar la habitación.' });
  }
};

const obtenerHabitaciones = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT DISTINCT ON (h.codigo_habitacion)
        h.codigo_habitacion,
        h.id_tipo_habitacion,
        th.nombre_tipo,
        h.piso,
        h.capacidad,
        h.estado,
        h.amenidades,
        COALESCE(t.precio_base, 120.00) AS precio_base,
        COALESCE(t.ocupacion_base, 2) AS ocupacion_base,
        COALESCE(t.huesped_adicional, 15.00) AS huesped_adicional,
        COALESCE(t.iva, 16.00) AS iva,
        hu.nombre AS nombre_huesped,
        TO_CHAR(r.fecha_checkin, 'DD/MM/YYYY') AS fecha_checkin,
        TO_CHAR(r.fecha_checkout, 'DD/MM/YYYY') AS fecha_checkout,
        r.monto_pagado
      FROM habitacion h
      JOIN tipo_habitacion th ON h.id_tipo_habitacion = th.id_tipo_habitacion
      LEFT JOIN tarifa_hab thab ON th.id_tipo_habitacion = thab.id_tipo_hab
      LEFT JOIN tarifa t ON thab.id_tarifa = t.id_tarifa AND t.estado = 'Activa'
      LEFT JOIN reserva r ON h.codigo_habitacion = r.codigo_habitacion AND r.estado IN ('PENDIENTE', 'CHECKIN', 'CONFIRMADA')
      LEFT JOIN huesped hu ON r.id_huesped = hu.id_huesped
      ORDER BY h.codigo_habitacion ASC, t.id_tarifa DESC;
    `;
    
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener habitaciones:', error);
    return respuesta.status(500).json({ 
      mensaje: 'Error al consultar la lista de habitaciones en la base de datos.' 
    });
  }
};

const obtenerHabitacionPorId = async (peticion, respuesta) => {
  const { id } = peticion.params;

  try {
    const consultaSQL = `
      SELECT DISTINCT ON (h.codigo_habitacion)
        h.codigo_habitacion,
        h.id_tipo_habitacion,
        th.nombre_tipo,
        h.piso,
        h.capacidad,
        h.estado,
        h.amenidades,
        COALESCE(t.precio_base, 120.00) AS precio_base,
        COALESCE(t.ocupacion_base, 2) AS ocupacion_base,
        COALESCE(t.huesped_adicional, 15.00) AS huesped_adicional,
        COALESCE(t.iva, 16.00) AS iva,
        hu.nombre AS nombre_huesped,
        TO_CHAR(r.fecha_checkin, 'DD/MM/YYYY') AS fecha_checkin,
        TO_CHAR(r.fecha_checkout, 'DD/MM/YYYY') AS fecha_checkout,
        r.monto_pagado
      FROM habitacion h
      JOIN tipo_habitacion th ON h.id_tipo_habitacion = th.id_tipo_habitacion
      LEFT JOIN tarifa_hab thab ON th.id_tipo_habitacion = thab.id_tipo_hab
      LEFT JOIN tarifa t ON thab.id_tarifa = t.id_tarifa AND t.estado = 'Activa'
      LEFT JOIN reserva r ON h.codigo_habitacion = r.codigo_habitacion AND r.estado IN ('PENDIENTE', 'CHECKIN', 'CONFIRMADA')
      LEFT JOIN huesped hu ON r.id_huesped = hu.id_huesped
      WHERE h.codigo_habitacion = $1
      ORDER BY h.codigo_habitacion ASC, t.id_tarifa DESC;
    `;

    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Habitación no encontrada.' });
    }

    return respuesta.status(200).json(resultado.rows[0]);
  } catch (error) {
    console.error(`Error al obtener la habitación ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al obtener los datos de la habitación.' });
  }
};

const crearHabitacion = async (peticion, respuesta) => {
  const { codigo_habitacion, id_tipo_habitacion, piso, capacidad, estado, amenidades } = peticion.body;

  if (!codigo_habitacion || !id_tipo_habitacion || !piso || !capacidad || !amenidades) {
    return respuesta.status(400).json({ 
      mensaje: 'Todos los campos obligatorios de la habitación deben ser completados.' 
    });
  }

  try {
    const consultaSQL = `
      INSERT INTO habitacion (codigo_habitacion, id_tipo_habitacion, piso, capacidad, estado, amenidades)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const resultado = await conexion.query(consultaSQL, [
      codigo_habitacion,
      id_tipo_habitacion,
      piso.trim(),
      capacidad,
      estado || 'Disponible',
      amenidades.trim()
    ]);

    // ✅ REGISTRAR AUDITORÍA AQUÍ (Cuando la inserción concluyó con éxito)
    await registrarAuditoria(peticion.body.id_usuario || 1, 'Habitaciones', `Registró la habitación N° ${codigo_habitacion}`);

    return respuesta.status(201).json({
      mensaje: 'Habitación registrada exitosamente.',
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al registrar habitación:', error);

    if (error.code === '23505') {
      return respuesta.status(400).json({ 
        mensaje: 'El número o código de habitación ya se encuentra registrado.' 
      });
    }

    return respuesta.status(500).json({ 
      mensaje: 'Error interno al intentar guardar la habitación.' 
    });
  }
};

const actualizarHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { id_tipo_habitacion, piso, capacidad, estado, amenidades } = peticion.body;

  if (!id_tipo_habitacion || !piso || !capacidad || !amenidades) {
    return respuesta.status(400).json({ 
      mensaje: 'Por favor completa todos los campos requeridos.' 
    });
  }

  try {
    const consultaSQL = `
      UPDATE habitacion
      SET id_tipo_habitacion = $1, piso = $2, capacidad = $3, estado = $4, amenidades = $5
      WHERE codigo_habitacion = $6
      RETURNING *;
    `;
    const resultado = await conexion.query(consultaSQL, [
      id_tipo_habitacion,
      piso.trim(),
      capacidad,
      estado || 'Disponible',
      amenidades.trim(),
      id
    ]);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'La habitación a actualizar no existe.' });
    }

    // ✅ REGISTRAR AUDITORÍA AQUÍ (Cuando 'id' está validado y la actualización fue exitosa)
    await registrarAuditoria(peticion.body.id_usuario || 1, 'Habitaciones', `Modificó la habitación N° ${id}`);

    return respuesta.status(200).json({ 
      mensaje: 'Habitación actualizada correctamente.',
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error al actualizar la habitación ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al actualizar la habitación.' });
  }
};

const checkinHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;

  try {
    const check = await conexion.query(
      'SELECT estado FROM habitacion WHERE codigo_habitacion = $1',
      [id]
    );

    if (check.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Habitación no encontrada.' });
    }

    if (check.rows[0].estado !== 'Disponible') {
      return respuesta.status(400).json({ 
        mensaje: 'Solo se puede hacer check-in en habitaciones Disponibles.' 
      });
    }

    const consultaSQL = `
      UPDATE habitacion
      SET estado = 'Ocupada'
      WHERE codigo_habitacion = $1
      RETURNING *;
    `;

    const resultado = await conexion.query(consultaSQL, [id]);

    // ✅ REGISTRAR AUDITORÍA AQUÍ
    await registrarAuditoria(peticion.body.id_usuario || 1, 'Habitaciones', `Hizo Check-in en la habitación N° ${id}`);

    return respuesta.status(200).json({
      mensaje: 'Check-in realizado correctamente.',
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error en check-in habitación ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al realizar el check-in.' });
  }
};

const checkoutHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;

  try {
    const check = await conexion.query(
      'SELECT estado FROM habitacion WHERE codigo_habitacion = $1',
      [id]
    );

    if (check.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Habitación no encontrada.' });
    }

    if (check.rows[0].estado !== 'Ocupada') {
      return respuesta.status(400).json({ 
        mensaje: 'Solo se puede hacer check-out en habitaciones Ocupadas.' 
      });
    }

    const consultaSQL = `
      UPDATE habitacion
      SET estado = 'Sucia'
      WHERE codigo_habitacion = $1
      RETURNING *;
    `;

    const resultado = await conexion.query(consultaSQL, [id]);

    // ✅ REGISTRAR AUDITORÍA AQUÍ
    await registrarAuditoria(peticion.body.id_usuario || 1, 'Habitaciones', `Hizo Check-out en la habitación N° ${id}`);

    return respuesta.status(200).json({
      mensaje: 'Check-out realizado. La habitación quedó en estado Sucia.',
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error en check-out habitación ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al realizar el check-out.' });
  }
};

const cambiarEstadoHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { estado } = peticion.body;

  const estadosValidos = ['Disponible', 'Ocupada', 'Sucia', 'Fuera de servicio'];

  if (!estado || !estadosValidos.includes(estado)) {
    return respuesta.status(400).json({ mensaje: 'Estado no válido.' });
  }

  try {
    const consultaSQL = `
      UPDATE habitacion
      SET estado = $1
      WHERE codigo_habitacion = $2
      RETURNING *;
    `;

    const resultado = await conexion.query(consultaSQL, [estado, id]);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'Habitación no encontrada.' });
    }

    // ✅ REGISTRAR AUDITORÍA AQUÍ
    await registrarAuditoria(peticion.body.id_usuario || 1, 'Habitaciones', `Cambió el estado de la habitación N° ${id} a ${estado}`);

    return respuesta.status(200).json({
      mensaje: `Habitación marcada como ${estado}.`,
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error al cambiar estado de habitación ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al cambiar el estado de la habitación.' });
  }
};

module.exports = {
  obtenerHabitaciones,
  obtenerHabitacionPorId,
  crearHabitacion,
  actualizarHabitacion,
  checkinHabitacion,
  checkoutHabitacion,
  cambiarEstadoHabitacion,
  eliminarHabitacion
};