const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');
const axios = require('axios');

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
      SELECT DISTINCT ON (r.codigo_reserva)
        r.codigo_reserva,
        r.id_huesped,
        h.nombre AS nombre_huesped,
        r.codigo_habitacion,
        hab.piso,
        th.id_tipo_habitacion,
        th.nombre_tipo AS nombre_tipo_habitacion,
        COALESCE(t.precio_base, 120.00) AS precio_base,
        COALESCE(t.ocupacion_base, 2) AS ocupacion_base,
        COALESCE(t.huesped_adicional, 15.00) AS huesped_adicional,
        COALESCE(t.iva, 16.00) AS iva,
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
      LEFT JOIN tarifa_temporada tt ON thab.id_tarifa = tt.id_tarifa
      LEFT JOIN temporada tp ON tt.id_temporada = tp.id_temporada
      LEFT JOIN tarifa t ON thab.id_tarifa = t.id_tarifa AND t.estado = 'Activa'
      WHERE r.id_telegram IS NULL
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
    fecha_checkin, 
    fecha_checkout, 
    cantidad_huespedes, 
    estado,
    monto_pagado,
    recargos_ids 
  } = peticion.body;

  if (!id_huesped || !codigo_habitacion || !fecha_checkin || !fecha_checkout || !cantidad_huespedes) {
    return respuesta.status(400).json({ 
      mensaje: 'Todos los campos obligatorios de la reserva deben ser completados.' 
    });
  }

  const hoyStr = new Date().toISOString().split('T')[0];
  if (fecha_checkin < hoyStr) {
    return respuesta.status(400).json({
      mensaje: 'La fecha de check-in no puede ser anterior a la fecha actual.'
    });
  }

  if (new Date(fecha_checkout) <= new Date(fecha_checkin)) {
    return respuesta.status(400).json({
      mensaje: 'La fecha de check-out debe ser posterior a la fecha de check-in.'
    });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    const consultaHabitacion = await cliente.query(
      'SELECT capacidad FROM habitacion WHERE codigo_habitacion = $1',
      [codigo_habitacion]
    );

    if (consultaHabitacion.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'La habitación seleccionada no existe.' });
    }

    const habInfo = consultaHabitacion.rows[0];
    if (parseInt(cantidad_huespedes) > parseInt(habInfo.capacidad)) {
      await cliente.query('ROLLBACK');
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

    const resultadoSolapamiento = await cliente.query(consultaSolapamiento, [
      codigo_habitacion,
      fecha_checkin,
      fecha_checkout
    ]);

    if (resultadoSolapamiento.rows.length > 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(400).json({
        mensaje: `La habitación N° ${codigo_habitacion} ya se encuentra reservada u ocupada en el rango de fechas seleccionado.`
      });
    }

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

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
    const resultado = await cliente.query(consultaSQL, [
      id_huesped,
      codigo_habitacion,
      idUsuarioResponsable,
      fecha_checkin,
      fecha_checkout,
      cantidad_huespedes,
      estadoReserva,
      monto_pagado || 0.00
    ]);

    const nuevaReserva = resultado.rows[0];

    if (Array.isArray(recargos_ids) && recargos_ids.length > 0) {
      for (const idRecargo of recargos_ids) {
        await cliente.query(
          'INSERT INTO reserva_recargo (codigo_reserva, id_recargo) VALUES ($1, $2) ON CONFLICT DO NOTHING;',
          [nuevaReserva.codigo_reserva, idRecargo]
        );
      }
    }

    if (estadoReserva.toUpperCase() === 'CHECKIN') {
      await cliente.query(
        "UPDATE habitacion SET estado = 'Ocupada' WHERE codigo_habitacion = $1",
        [codigo_habitacion]
      );
    }

    const huespedRes = await cliente.query('SELECT nombre FROM huesped WHERE id_huesped = $1', [id_huesped]);
    const nombreHuesped = huespedRes.rows[0]?.nombre || 'un huésped';

    await cliente.query('COMMIT');

    await registrarAuditoria(
      idUsuarioResponsable,
      'Reservas',
      `Creó la reserva N° ${nuevaReserva.codigo_reserva} para el huésped "${nombreHuesped}" en la habitación N° ${codigo_habitacion}`
    );

    return respuesta.status(201).json({
      mensaje: 'Reserva registrada exitosamente.',
      reserva: nuevaReserva
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al registrar reserva:', error);
    return respuesta.status(500).json({
      mensaje: 'Error interno al intentar guardar la reserva.'
    });
  } finally {
    cliente.release();
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

  const hoyStr = new Date().toISOString().split('T')[0];
  if (fecha_checkin < hoyStr) {
    return respuesta.status(400).json({
      mensaje: 'La fecha de check-in no puede ser anterior a la fecha actual.'
    });
  }

  if (new Date(fecha_checkout) <= new Date(fecha_checkin)) {
    return respuesta.status(400).json({
      mensaje: 'La fecha de check-out debe ser posterior a la fecha de check-in.'
    });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    const reservaAntiguaRes = await cliente.query(`
      SELECT r.*, h.nombre AS nombre_huesped 
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      WHERE r.codigo_reserva = $1;
    `, [id]);

    if (reservaAntiguaRes.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'La reserva a actualizar no existe.' });
    }

    const reservaAntigua = reservaAntiguaRes.rows[0];

    const consultaHabitacion = await cliente.query(
      'SELECT capacidad FROM habitacion WHERE codigo_habitacion = $1',
      [codigo_habitacion]
    );

    if (consultaHabitacion.rows.length > 0) {
      const capMax = consultaHabitacion.rows[0].capacidad;
      if (parseInt(cantidad_huespedes) > parseInt(capMax)) {
        await cliente.query('ROLLBACK');
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

    const resultadoSolapamiento = await cliente.query(consultaSolapamiento, [
      codigo_habitacion,
      id,
      fecha_checkin,
      fecha_checkout
    ]);

    if (resultadoSolapamiento.rows.length > 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(400).json({
        mensaje: `La habitación N° ${codigo_habitacion} ya está reservada en esas fechas por otra reserva activa.`
      });
    }

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

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

    const resultado = await cliente.query(consultaSQL, [
      id_huesped,
      codigo_habitacion,
      fecha_checkin,
      fecha_checkout,
      cantidad_huespedes,
      estado || 'PENDIENTE',
      monto_pagado || 0.00,
      id
    ]);

    await cliente.query('DELETE FROM reserva_recargo WHERE codigo_reserva = $1;', [id]);
    if (Array.isArray(recargos_ids) && recargos_ids.length > 0) {
      for (const idRecargo of recargos_ids) {
        await cliente.query(
          'INSERT INTO reserva_recargo (codigo_reserva, id_recargo) VALUES ($1, $2) ON CONFLICT DO NOTHING;',
          [id, idRecargo]
        );
      }
    }

    const huespedNuevoRes = await cliente.query('SELECT nombre FROM huesped WHERE id_huesped = $1', [id_huesped]);
    const nombreHuespedNuevo = huespedNuevoRes.rows[0]?.nombre || 'Huésped';

    await cliente.query('COMMIT');

    let cambios = [];
    if (reservaAntigua.nombre_huesped !== nombreHuespedNuevo) cambios.push(`huésped de "${reservaAntigua.nombre_huesped}" a "${nombreHuespedNuevo}"`);
    if (Number(reservaAntigua.codigo_habitacion) !== Number(codigo_habitacion)) cambios.push(`habitación de N° ${reservaAntigua.codigo_habitacion} a N° ${codigo_habitacion}`);
    if (String(reservaAntigua.estado) !== String(estado || 'PENDIENTE')) cambios.push(`estado de "${reservaAntigua.estado}" a "${estado || 'PENDIENTE'}"`);

    const detalleCambios = cambios.length > 0 ? cambios.join(', ') : 'actualizó los detalles de la estancia';

    await registrarAuditoria(
      idUsuarioResponsable,
      'Reservas',
      `Actualizó la reserva N° ${id} del huésped "${nombreHuespedNuevo}": ${detalleCambios}`
    );

    return respuesta.status(200).json({
      mensaje: 'Reserva actualizada correctamente.',
      reserva: resultado.rows[0]
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al actualizar la reserva ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al actualizar la reserva.' });
  } finally {
    cliente.release();
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
        COALESCE(t.precio_base, 120.00) AS precio_base, 
        COALESCE(t.ocupacion_base, 2) AS ocupacion_base, 
        COALESCE(t.huesped_adicional, 15.00) AS huesped_adicional, 
        COALESCE(t.iva, 16.00) AS iva,
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
  const { estado, mensaje_personalizado } = peticion.body;
  const estadosValidos = ['PENDIENTE', 'CONFIRMADA', 'CHECKIN', 'CHECKOUT', 'CANCELADA'];

  if (!estado || !estadosValidos.includes(estado.toUpperCase())) {
    return respuesta.status(400).json({ mensaje: 'Estado no válido.' });
  }

  try {
    const reservaActual = await conexion.query(`
      SELECT r.codigo_habitacion, r.id_telegram, h.nombre AS nombre_huesped 
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      WHERE r.codigo_reserva = $1
    `, [id]);

    if (reservaActual.rows.length === 0) return respuesta.status(404).json({ mensaje: 'Reserva no encontrada.' });

    const { codigo_habitacion, id_telegram, nombre_huesped } = reservaActual.rows[0];
    const nuevoEstado = estado.toUpperCase();

    let resultado;
    if (id_telegram && (nuevoEstado === 'CONFIRMADA' || nuevoEstado === 'CANCELADA')) {
      resultado = await conexion.query(
        'UPDATE reserva SET estado = $1, id_telegram = NULL, usuario_telegram = NULL WHERE codigo_reserva = $2 RETURNING *;',
        [nuevoEstado, id]
      );
    } else {
      resultado = await conexion.query(
        'UPDATE reserva SET estado = $1 WHERE codigo_reserva = $2 RETURNING *;',
        [nuevoEstado, id]
      );
    }

    if (nuevoEstado === 'CHECKIN') await conexion.query("UPDATE habitacion SET estado = 'Ocupada' WHERE codigo_habitacion = $1", [codigo_habitacion]);
    else if (nuevoEstado === 'CHECKOUT') await conexion.query("UPDATE habitacion SET estado = 'Sucia' WHERE codigo_habitacion = $1", [codigo_habitacion]);
    else if (nuevoEstado === 'CANCELADA') await conexion.query("UPDATE habitacion->'estado' SET estado = 'Disponible' WHERE codigo_habitacion = $1", [codigo_habitacion]).catch(() => {
      conexion.query("UPDATE habitacion SET estado = 'Disponible' WHERE codigo_habitacion = $1", [codigo_habitacion]);
    });

    if (id_telegram) {
      const tokenBot = process.env.TELEGRAM_BOT_TOKEN;
      const urlApiTelegram = `https://api.telegram.org/bot${tokenBot}/sendMessage`;

      let mensajeTexto = '';
      if (mensaje_personalizado && mensaje_personalizado.trim() !== '') {
        mensajeTexto = mensaje_personalizado.trim();
      } else {
        if (nuevoEstado === 'CONFIRMADA') {
          mensajeTexto = `¡Buenas noticias! Tu reserva N° ${id} ha sido *CONFIRMADA*. ¡Te esperamos en el hotel!`;
        } else if (nuevoEstado === 'CANCELADA') {
          mensajeTexto = `Lamentamos informarte que tu reserva N° ${id} ha sido *CANCELADA*.`;
        } else {
          mensajeTexto = `Tu reserva N° ${id} ha cambiado al estado: *${nuevoEstado}*.`;
        }
      }

      try {
        await axios.post(urlApiTelegram, {
          chat_id: id_telegram,
          text: `*[ HOTEL - NOTIFICACIÓN ]*\n\n${mensajeTexto}`,
          parse_mode: 'Markdown'
        });

        await conexion.query(
          `INSERT INTO telegram_notificacion_log (codigo_reserva, mensaje, entregado) VALUES ($1, $2, $3)`,
          [id, mensajeTexto, true]
        );
      } catch (errorTelegram) {
        console.error('Error al enviar notificación a Telegram:', errorTelegram.message);
      }
    }

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(
      idUsuarioResponsable,
      'Reservas',
      `Cambió el estado de la reserva N° ${id} a ${nuevoEstado} y la trasladó al panel general`
    );

    return respuesta.status(200).json({ mensaje: `Reserva ${nuevoEstado.toLowerCase()} con éxito.`, reserva: resultado.rows[0] });
  } catch (error) {
    console.error('Error al cambiar estado de la reserva:', error);
    return respuesta.status(500).json({ mensaje: 'Error al cambiar el estado.' });
  }
};

const eliminarReserva = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const cliente = await conexion.connect();
  try {
    await cliente.query('BEGIN;');

    const reservaInfo = await cliente.query(`
      SELECT h.nombre AS nombre_huesped 
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      WHERE r.codigo_reserva = $1
    `, [id]);

    const nombreHuesped = reservaInfo.rows[0]?.nombre_huesped || 'Huésped';

    await cliente.query('DELETE FROM pago WHERE codigo_reserva = $1;', [id]);
    await cliente.query('DELETE FROM reserva_recargo WHERE codigo_reserva = $1;', [id]);

    const resultado = await cliente.query('DELETE FROM reserva WHERE codigo_reserva = $1 RETURNING *;', [id]);

    if (resultado.rowCount === 0) {
      await cliente.query('ROLLBACK;');
      return respuesta.status(404).json({ mensaje: 'Reserva no encontrada.' });
    }

    await cliente.query('COMMIT;');

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(
      idUsuarioResponsable,
      'Reservas',
      `Eliminó permanentemente la reserva N° ${id} del huésped "${nombreHuesped}"`
    );

    return respuesta.status(200).json({ mensaje: 'Reserva eliminada con éxito.' });
  } catch (error) {
    await cliente.query('ROLLBACK;');
    console.error('Error al eliminar reserva:', error);
    return respuesta.status(500).json({ mensaje: 'Error al eliminar la reserva.' });
  } finally {
    cliente.release();
  }
};

const obtenerReservasTelegram = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        r.codigo_reserva,
        r.id_huesped,
        h.nombre AS nombre_huesped,
        h.telefono,
        h.correo,
        r.codigo_habitacion,
        r.fecha_checkin,
        r.fecha_checkout,
        r.cantidad_huespedes,
        r.estado,
        r.monto_pagado,
        r.id_telegram,
        r.usuario_telegram,
        r.creado_en,
        COALESCE(
          (SELECT json_agg(json_build_object('fecha', l.fecha_hora, 'mensaje', l.mensaje, 'entregado', l.entregado))
           FROM telegram_notificacion_log l 
           WHERE l.codigo_reserva = r.codigo_reserva), '[]'
        ) AS historial_notificaciones
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      WHERE r.id_telegram IS NOT NULL
      ORDER BY r.codigo_reserva DESC;
    `;
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener reservas de Telegram:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar las reservas de Telegram.' });
  }
};

const crearReservaTelegram = async (peticion, respuesta) => {
  const { id_huesped, codigo_habitacion, fecha_checkin, fecha_checkout, cantidad_huespedes, id_telegram, usuario_telegram, monto_pagado } = peticion.body;

  if (!id_huesped || !codigo_habitacion || !fecha_checkin || !fecha_checkout || !id_telegram) {
    return respuesta.status(400).json({ mensaje: 'Faltan datos obligatorios para registrar la reserva de Telegram.' });
  }

  const hoyStr = new Date().toISOString().split('T')[0];
  if (fecha_checkin < hoyStr) {
    return respuesta.status(400).json({
      mensaje: 'La fecha de check-in no puede ser anterior a la fecha actual.'
    });
  }

  const cliente = await conexion.connect();
  try {
    await cliente.query('BEGIN');

    const consultaSQL = `
      INSERT INTO reserva (id_huesped, codigo_habitacion, id_usuario, fecha_checkin, fecha_checkout, cantidad_huespedes, estado, monto_pagado, id_telegram, usuario_telegram)
      VALUES ($1, $2, 1, $3, $4, $5, 'PENDIENTE', $6, $7, $8)
      RETURNING *;
    `;
    const resultado = await cliente.query(consultaSQL, [
      id_huesped, codigo_habitacion, fecha_checkin, fecha_checkout, cantidad_huespedes, monto_pagado || 0.00, id_telegram, usuario_telegram
    ]);

    const nuevaReserva = resultado.rows[0];
    await cliente.query('COMMIT');

    return respuesta.status(201).json({
      mensaje: 'Reserva de Telegram registrada con éxito.',
      reserva: nuevaReserva
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al crear reserva de Telegram:', error);
    return respuesta.status(500).json({ mensaje: 'Error al procesar la reserva desde el bot.' });
  } finally {
    cliente.release();
  }
};

const enviarNotificacionTelegram = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { mensaje } = peticion.body;

  if (!mensaje || !mensaje.trim()) {
    return respuesta.status(400).json({ mensaje: 'El mensaje de notificación no puede estar vacío.' });
  }

  try {
    const reservaRes = await conexion.query('SELECT id_telegram, codigo_reserva FROM reserva WHERE codigo_reserva = $1', [id]);
    if (reservaRes.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Reserva no encontrada.' });
    }

    const idTelegramHuesped = reservaRes.rows[0].id_telegram;
    let entregado = true;

    if (idTelegramHuesped) {
      const tokenBot = process.env.TELEGRAM_BOT_TOKEN;
      const urlApiTelegram = `https://api.telegram.org/bot${tokenBot}/sendMessage`;

      try {
        await axios.post(urlApiTelegram, {
          chat_id: idTelegramHuesped,
          text: `*[ HOTEL - NOTIFICACIÓN ]*\n\n${mensaje.trim()}`,
          parse_mode: 'Markdown'
        });
      } catch (errorTelegram) {
        console.error('Error al despachar mensaje a la API de Telegram:', errorTelegram.message);
        entregado = false;
      }
    } else {
      entregado = false;
    }

    const logSQL = `
      INSERT INTO telegram_notificacion_log (codigo_reserva, mensaje, entregado)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const logResultado = await conexion.query(logSQL, [id, mensaje.trim(), entregado]);

    return respuesta.status(200).json({
      mensaje: entregado ? 'Notificación transmitida al chat de Telegram con éxito.' : 'Guardado en sistema, pero no se pudo enviar a Telegram (sin chat ID o error de red).',
      detalle: logResultado.rows[0]
    });
  } catch (error) {
    console.error('Error al enviar notificación de Telegram:', error);
    return respuesta.status(500).json({ mensaje: 'Error interno al enviar la notificación.' });
  }
};

// Reporte detallado de reservas para exportar
const obtenerReporteReservas = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        r.codigo_reserva AS clave,
        h.id_huesped,
        h.nombre AS nombre_huesped,
        h.tipo_documento || '-' || h.num_documento AS documento,
        hab.codigo_habitacion AS habitacion_asignada,
        th.nombre_tipo AS tipo_habitacion,
        hab.piso,
        r.fecha_checkin,
        r.fecha_checkout,
        r.cantidad_huespedes,
        r.estado,
        r.monto_pagado
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      JOIN habitacion hab ON r.codigo_habitacion = hab.codigo_habitacion
      JOIN tipo_habitacion th ON hab.id_tipo_habitacion = th.id_tipo_habitacion
      ORDER BY r.codigo_reserva DESC;
    `;

    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al generar el reporte de reservas:', error);
    return respuesta.status(500).json({ 
      mensaje: 'Error al consultar los datos para el reporte de reservas.' 
    });
  }
};

module.exports = {
  obtenerReservas,
  obtenerReservaPorId,
  crearReserva,
  actualizarReserva,
  cambiarEstadoReserva,
  eliminarReserva,
  obtenerReservasTelegram,
  crearReservaTelegram,
  enviarNotificacionTelegram,
  obtenerReporteReservas
};