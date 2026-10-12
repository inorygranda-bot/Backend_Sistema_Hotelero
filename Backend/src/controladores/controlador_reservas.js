const conexion = require('../config/conexion');

const actualizarEstadosAutomaticosPorFecha = async () => {
  try {
    const consultaCheckin = `
      UPDATE reserva
      SET estado = 'CHECKIN'
      WHERE estado = 'CONFIRMADA'
        AND fecha_checkin <= CURRENT_DATE
      RETURNING codigo_reserva, codigo_habitacion;
    `;
    const resultadoCheckin = await conexion.query(consultaCheckin);
    for (const reserva of resultadoCheckin.rows) {
      await conexion.query(
        "UPDATE habitacion SET estado = 'Ocupada' WHERE codigo_habitacion = $1 AND estado != 'Fuera de servicio'",
        [reserva.codigo_habitacion]
      );
    }

    const consultaCheckout = `
      UPDATE reserva
      SET estado = 'CHECKOUT'
      WHERE estado = 'CHECKIN'
        AND fecha_checkout <= CURRENT_DATE
      RETURNING codigo_reserva, codigo_habitacion;
    `;
    const resultadoCheckout = await conexion.query(consultaCheckout);
    for (const reserva of resultadoCheckout.rows) {
      await conexion.query(
        "UPDATE habitacion SET estado = 'Sucia' WHERE codigo_habitacion = $1",
        [reserva.codigo_habitacion]
      );
    }
  } catch (error) {
    console.error('Error al ejecutar la actualización automática de estados por fecha:', error);
  }
};

const obtenerReservas = async (peticion, respuesta) => {
  try {
    await actualizarEstadosAutomaticosPorFecha();

    const consultaSQL = `
      SELECT 
        r.codigo_reserva,
        r.id_huesped,
        h.nombre AS nombre_huesped,
        r.codigo_habitacion,
        hab.piso,
        th.id_tipo_habitacion,
        th.nombre_tipo AS nombre_tipo_habitacion,
        t.precio_base,
        t.ocupacion_base,
        t.huesped_adicional,
        t.iva,
        r.id_usuario,
        r.fecha_checkin,
        r.fecha_checkout,
        r.cantidad_huespedes,
        r.estado,
        r.creado_en,
        r.monto_pagado,
        COALESCE(
          (SELECT json_agg(json_build_object('id_recargo', rec.id_recargo, 'motivo_recargo', rec.motivo_recargo, 'tipo_operacion', rec.tipo_operacion, 'tipo_calculo', rec.tipo_calculo, 'monto', rec.monto))
           FROM reserva_recargo rr 
           JOIN recargo rec ON rr.id_recargo = rec.id_recargo 
           WHERE rr.codigo_reserva = r.codigo_reserva), '[]'
        ) AS recargos
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      JOIN habitacion hab ON r.codigo_habitacion = hab.codigo_habitacion
      JOIN tipo_habitacion th ON hab.id_tipo_habitacion = th.id_tipo_habitacion
      LEFT JOIN tarifa_hab thab ON th.id_tipo_habitacion = thab.id_tipo_hab
      LEFT JOIN tarifa t ON thab.id_tarifa = t.id_tarifa AND t.estado = 'Activa'
      ORDER BY r.codigo_reserva DESC;
    `;
    
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener la lista de reservas:', error);
    return respuesta.status(500).json({ 
      mensaje: 'Error al consultar las reservas en la base de datos.' 
    });
  }
};

const crearReserva = async (peticion, respuesta) => {
  const { 
    id_huesped, 
    codigo_habitacion, 
    id_usuario, 
    fecha_checkin, 
    fecha_checkout, 
    cantidad_huespedes, 
    estado,
    monto_pagado,
    recargos_ids // Array de IDs de recargos seleccionados
  } = peticion.body;

  if (!id_huesped || !codigo_habitacion || !fecha_checkin || !fecha_checkout || !cantidad_huespedes) {
    return respuesta.status(400).json({ 
      mensaje: 'Todos los campos obligatorios de la reserva deben ser completados.' 
    });
  }

  if (new Date(fecha_checkout) <= new Date(fecha_checkin)) {
    return respuesta.status(400).json({
      mensaje: 'La fecha de check-out debe ser posterior a la fecha de check-in.'
    });
  }

  try {
    const consultaHabitacion = await conexion.query(
      'SELECT estado, capacidad FROM habitacion WHERE codigo_habitacion = $1',
      [codigo_habitacion]
    );

    if (consultaHabitacion.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'La habitación seleccionada no existe.' });
    }

    const habInfo = consultaHabitacion.rows[0];
    if (habInfo.estado.toLowerCase() !== 'disponible') {
      return respuesta.status(400).json({
        mensaje: `No se puede reservar. La habitación N° ${codigo_habitacion} se encuentra en estado "${habInfo.estado}".`
      });
    }

    if (parseInt(cantidad_huespedes) > parseInt(habInfo.capacidad)) {
      return respuesta.status(400).json({
        mensaje: `La cantidad de huéspedes (${cantidad_huespedes}) supera la capacidad máxima de la habitación (${habInfo.capacidad} personas).`
      });
    }

    const consultaSolapamiento = `
      SELECT codigo_reserva FROM reserva
      WHERE codigo_habitacion = $1 
        AND estado NOT IN ('CANCELADA', 'CHECKOUT')
        AND fecha_checkin < $3 
        AND fecha_checkout > $2;
    `;
    
    const resultadoSolapamiento = await conexion.query(consultaSolapamiento, [
      codigo_habitacion,
      fecha_checkin,
      fecha_checkout
    ]);

    if (resultadoSolapamiento.rows.length > 0) {
      return respuesta.status(400).json({
        mensaje: `La habitación N° ${codigo_habitacion} ya se encuentra reservada u ocupada en el rango de fechas seleccionado.`
      });
    }

    const consultaSQL = `
      INSERT INTO reserva (
        id_huesped, 
        codigo_habitacion, 
        id_usuario, 
        fecha_checkin, 
        fecha_checkout, 
        cantidad_huespedes, 
        estado,
        monto_pagado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    
    const estadoReserva = estado || 'PENDIENTE';
    const resultado = await conexion.query(consultaSQL, [
      id_huesped,
      codigo_habitacion,
      id_usuario || 1,
      fecha_checkin,
      fecha_checkout,
      cantidad_huespedes,
      estadoReserva,
      monto_pagado || 0.00
    ]);

    const nuevaReserva = resultado.rows[0];

    // Insertar recargos asociados si existen
    if (Array.isArray(recargos_ids) && recargos_ids.length > 0) {
      for (const idRecargo of recargos_ids) {
        await conexion.query(
          'INSERT INTO reserva_recargo (codigo_reserva, id_recargo) VALUES ($1, $2) ON CONFLICT DO NOTHING;',
          [nuevaReserva.codigo_reserva, idRecargo]
        );
      }
    }

    if (estadoReserva.toUpperCase() === 'CHECKIN') {
      await conexion.query(
        "UPDATE habitacion SET estado = 'Ocupada' WHERE codigo_habitacion = $1",
        [codigo_habitacion]
      );
    }

    return respuesta.status(201).json({
      mensaje: 'Reserva registrada exitosamente.',
      reserva: nuevaReserva
    });
  } catch (error) {
    console.error('Error al registrar reserva:', error);
    return respuesta.status(500).json({ 
      mensaje: 'Error interno al intentar guardar la reserva.' 
    });
  }
};

const actualizarReserva = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { 
    id_huesped, 
    codigo_habitacion, 
    fecha_checkin, 
    fecha_checkout, 
    cantidad_huespedes, 
    estado,
    monto_pagado,
    recargos_ids
  } = peticion.body;

  if (!id_huesped || !codigo_habitacion || !fecha_checkin || !fecha_checkout || !cantidad_huespedes) {
    return respuesta.status(400).json({ 
      mensaje: 'Por favor completa todos los campos requeridos para actualizar la reserva.' 
    });
  }

  if (new Date(fecha_checkout) <= new Date(fecha_checkin)) {
    return respuesta.status(400).json({
      mensaje: 'La fecha de check-out debe ser posterior a la fecha de check-in.'
    });
  }

  try {
    const consultaHabitacion = await conexion.query(
      'SELECT capacidad FROM habitacion WHERE codigo_habitacion = $1',
      [codigo_habitacion]
    );

    if (consultaHabitacion.rows.length > 0) {
      const capMax = consultaHabitacion.rows[0].capacidad;
      if (parseInt(cantidad_huespedes) > parseInt(capMax)) {
        return respuesta.status(400).json({
          mensaje: `La cantidad de huéspedes (${cantidad_huespedes}) supera la capacidad máxima de la habitación (${capMax} personas).`
        });
      }
    }

    const consultaSolapamiento = `
      SELECT codigo_reserva FROM reserva
      WHERE codigo_habitacion = $1 
        AND estado NOT IN ('CANCELADA', 'CHECKOUT')
        AND codigo_reserva != $2
        AND fecha_checkin < $4 
        AND fecha_checkout > $3;
    `;

    const resultadoSolapamiento = await conexion.query(consultaSolapamiento, [
      codigo_habitacion,
      id,
      fecha_checkin,
      fecha_checkout
    ]);

    if (resultadoSolapamiento.rows.length > 0) {
      return respuesta.status(400).json({
        mensaje: `La habitación N° ${codigo_habitacion} ya está reservada en esas fechas por otra reserva activa.`
      });
    }

    const consultaSQL = `
      UPDATE reserva
      SET 
        id_huesped = $1, 
        codigo_habitacion = $2, 
        fecha_checkin = $3, 
        fecha_checkout = $4, 
        cantidad_huespedes = $5, 
        estado = $6,
        monto_pagado = $7
      WHERE codigo_reserva = $8
      RETURNING *;
    `;
    
    const resultado = await conexion.query(consultaSQL, [
      id_huesped,
      codigo_habitacion,
      fecha_checkin,
      fecha_checkout,
      cantidad_huespedes,
      estado || 'PENDIENTE',
      monto_pagado || 0.00,
      id
    ]);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'La reserva a actualizar no existe.' });
    }

    // Actualizar recargos asociados
    await conexion.query('DELETE FROM reserva_recargo WHERE codigo_reserva = $1;', [id]);
    if (Array.isArray(recargos_ids) && recargos_ids.length > 0) {
      for (const idRecargo of recargos_ids) {
        await conexion.query(
          'INSERT INTO reserva_recargo (codigo_reserva, id_recargo) VALUES ($1, $2) ON CONFLICT DO NOTHING;',
          [id, idRecargo]
        );
      }
    }

    return respuesta.status(200).json({ 
      mensaje: 'Reserva actualizada correctamente.',
      reserva: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error al actualizar la reserva ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al actualizar la reserva.' });
  }
};

const obtenerReservaPorId = async (peticion, respuesta) => {
  const { id } = peticion.params;
  try {
    const consultaSQL = `
      SELECT 
        r.*,
        h.nombre AS nombre_huesped,
        hab.piso,
        th.nombre_tipo AS nombre_tipo_habitacion,
        t.precio_base, t.ocupacion_base, t.huesped_adicional, t.iva,
        COALESCE(
          (SELECT json_agg(json_build_object('id_recargo', rec.id_recargo, 'motivo_recargo', rec.motivo_recargo, 'tipo_operacion', rec.tipo_operacion, 'tipo_calculo', rec.tipo_calculo, 'monto', rec.monto))
           FROM reserva_recargo rr 
           JOIN recargo rec ON rr.id_recargo = rec.id_recargo 
           WHERE rr.codigo_reserva = r.codigo_reserva), '[]'
        ) AS recargos
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      JOIN habitacion hab ON r.codigo_habitacion = hab.codigo_habitacion
      JOIN tipo_habitacion th ON hab.id_tipo_habitacion = th.id_tipo_habitacion
      LEFT JOIN tarifa_hab thab ON th.id_tipo_habitacion = thab.id_tipo_hab
      LEFT JOIN tarifa t ON thab.id_tarifa = t.id_tarifa AND t.estado = 'Activa'
      WHERE r.codigo_reserva = $1;
    `;
    const resultado = await conexion.query(consultaSQL, [id]);
    if (resultado.rows.length === 0) return respuesta.status(404).json({ mensaje: 'Reserva no encontrada.' });
    return respuesta.status(200).json(resultado.rows[0]);
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Error al obtener la reserva.' });
  }
};

const cambiarEstadoReserva = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { estado } = peticion.body;
  const estadosValidos = ['PENDIENTE', 'CONFIRMADA', 'CHECKIN', 'CHECKOUT', 'CANCELADA'];
  if (!estado || !estadosValidos.includes(estado.toUpperCase())) {
    return respuesta.status(400).json({ mensaje: 'Estado no válido.' });
  }
  try {
    const reservaActual = await conexion.query('SELECT codigo_habitacion FROM reserva WHERE codigo_reserva = $1', [id]);
    if (reservaActual.rows.length === 0) return respuesta.status(404).json({ mensaje: 'Reserva no encontrada.' });
    const codigoHabitacion = reservaActual.rows[0].codigo_habitacion;
    const nuevoEstado = estado.toUpperCase();
    const resultado = await conexion.query('UPDATE reserva SET estado = $1 WHERE codigo_reserva = $2 RETURNING *;', [nuevoEstado, id]);
    
    if (nuevoEstado === 'CHECKIN') await conexion.query("UPDATE habitacion SET estado = 'Ocupada' WHERE codigo_habitacion = $1", [codigoHabitacion]);
    else if (nuevoEstado === 'CHECKOUT') await conexion.query("UPDATE habitacion SET estado = 'Sucia' WHERE codigo_habitacion = $1", [codigoHabitacion]);
    else if (nuevoEstado === 'CANCELADA') await conexion.query("UPDATE habitacion SET estado = 'Disponible' WHERE codigo_habitacion = $1", [codigoHabitacion]);

    return respuesta.status(200).json({ mensaje: 'Estado actualizado', reserva: resultado.rows[0] });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Error al cambiar estado.' });
  }
};

const eliminarReserva = async (peticion, respuesta) => {
  const { id } = peticion.params;
  try {
    await conexion.query('DELETE FROM reserva_recargo WHERE codigo_reserva = $1;', [id]);
    const resultado = await conexion.query('DELETE FROM reserva WHERE codigo_reserva = $1 RETURNING *;', [id]);
    if (resultado.rowCount === 0) return respuesta.status(404).json({ mensaje: 'Reserva no encontrada.' });
    return respuesta.status(200).json({ mensaje: 'Reserva eliminada con éxito.' });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Error al eliminar la reserva.' });
  }
};

module.exports = {
  obtenerReservas,
  obtenerReservaPorId,
  crearReserva,
  actualizarReserva,
  cambiarEstadoReserva,
  eliminarReserva
};