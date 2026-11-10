const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');
const nodemailer = require('nodemailer');

const filtrarHabitacionesQuery = (query, baseSQL = '') => {
  const { estado, tipo, piso, busqueda } = query;
  let consultaSQL = baseSQL;
  const valores = [];
  let idx = 1;

  if (estado && estado !== 'TODAS' && estado !== 'undefined' && estado !== 'null') {
    consultaSQL += ` AND h.estado ILIKE $${idx}`;
    valores.push(estado);
    idx++;
  }
  if (tipo && tipo !== 'TODOS' && tipo !== 'undefined' && tipo !== 'null') {
    consultaSQL += ` AND th.nombre_tipo ILIKE $${idx}`;
    valores.push(tipo);
    idx++;
  }
  if (piso && piso !== 'TODOS' && piso !== 'undefined' && piso !== 'null') {
    consultaSQL += ` AND h.piso ILIKE $${idx}`;
    valores.push(piso);
    idx++;
  }
  if (busqueda && busqueda.trim() !== '' && busqueda !== 'undefined' && busqueda !== 'null') {
    consultaSQL += ` AND (h.codigo_habitacion::text ILIKE $${idx} OR th.nombre_tipo ILIKE $${idx} OR COALESCE(hu.nombre, '') ILIKE $${idx} OR h.amenidades ILIKE $${idx})`;
    valores.push(`%${busqueda.trim()}%`);
    idx++;
  }

  return { consultaSQL, valores };
};

const obtenerHabitaciones = async (peticion, respuesta) => {
  try {
    let baseSQL = `
      SELECT DISTINCT ON (h.codigo_habitacion)
        h.codigo_habitacion,
        h.id_tipo_habitacion,
        th.nombre_tipo,
        h.piso,
        h.capacidad,
        h.estado,
        h.amenidades,
        COALESCE(t.precio_base, 120.00) AS precio_base,
        hu.nombre AS nombre_huesped,
        r.fecha_checkin,
        r.fecha_checkout
      FROM habitacion h
      JOIN tipo_habitacion th ON h.id_tipo_habitacion = th.id_tipo_habitacion
      LEFT JOIN tarifa_hab thab ON th.id_tipo_habitacion = thab.id_tipo_hab
      LEFT JOIN tarifa t ON thab.id_tarifa = t.id_tarifa AND t.estado = 'Activa'
      LEFT JOIN reserva r ON h.codigo_habitacion = r.codigo_habitacion AND r.estado IN ('PENDIENTE', 'CHECKIN', 'CONFIRMADA')
      LEFT JOIN huesped hu ON r.id_huesped = hu.id_huesped
      WHERE 1=1
    `;
    const { consultaSQL, valores } = filtrarHabitacionesQuery(peticion.query, baseSQL);
    const consultaFinal = consultaSQL + ` ORDER BY h.codigo_habitacion ASC, t.id_tarifa DESC;`;
    
    const resultado = await conexion.query(consultaFinal, valores);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener habitaciones:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar las habitaciones.' });
  }
};

const obtenerReporteHabitaciones = async (peticion, respuesta) => {
  try {
    let baseSQL = `
      SELECT 
        h.codigo_habitacion AS clave,
        h.piso,
        th.nombre_tipo AS tipo_habitacion,
        h.capacidad,
        h.estado,
        h.amenidades,
        COALESCE(t.precio_base, 120.00) AS precio_base,
        hu.nombre AS nombre_huesped,
        r.fecha_checkin,
        r.fecha_checkout
      FROM habitacion h
      JOIN tipo_habitacion th ON h.id_tipo_habitacion = th.id_tipo_habitacion
      LEFT JOIN tarifa_hab thab ON th.id_tipo_habitacion = thab.id_tipo_hab
      LEFT JOIN tarifa t ON thab.id_tarifa = t.id_tarifa AND t.estado = 'Activa'
      LEFT JOIN reserva r ON h.codigo_habitacion = r.codigo_habitacion AND r.estado IN ('PENDIENTE', 'CHECKIN', 'CONFIRMADA')
      LEFT JOIN huesped hu ON r.id_huesped = hu.id_huesped
      WHERE 1=1
    `;
    const { consultaSQL, valores } = filtrarHabitacionesQuery(peticion.query, baseSQL);
    const consultaFinal = consultaSQL + ` ORDER BY h.codigo_habitacion ASC;`;

    const resultado = await conexion.query(consultaFinal, valores);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al generar reporte de habitaciones:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar los datos para el reporte de habitaciones.' });
  }
};

const enviarReporteHabitacionesCorreo = async (peticion, respuesta) => {
  const { correo_destino, estado, tipo, piso, busqueda } = peticion.body;

  if (!correo_destino || !correo_destino.trim()) {
    return respuesta.status(400).json({ mensaje: 'Debe especificar un correo electrónico de destino.' });
  }

  try {
    let baseSQL = `
      SELECT 
        h.codigo_habitacion AS clave,
        h.piso,
        th.nombre_tipo AS tipo_habitacion,
        h.capacidad,
        h.estado,
        COALESCE(t.precio_base, 120.00) AS precio_base,
        hu.nombre AS nombre_huesped
      FROM habitacion h
      JOIN tipo_habitacion th ON h.id_tipo_habitacion = th.id_tipo_habitacion
      LEFT JOIN tarifa_hab thab ON th.id_tipo_habitacion = thab.id_tipo_hab
      LEFT JOIN tarifa t ON thab.id_tarifa = t.id_tarifa AND t.estado = 'Activa'
      LEFT JOIN reserva r ON h.codigo_habitacion = r.codigo_habitacion AND r.estado IN ('PENDIENTE', 'CHECKIN', 'CONFIRMADA')
      LEFT JOIN huesped hu ON r.id_huesped = hu.id_huesped
      WHERE 1=1
    `;
    const { consultaSQL, valores } = filtrarHabitacionesQuery({ estado, tipo, piso, busqueda }, baseSQL);
    const consultaFinal = consultaSQL + ` ORDER BY h.codigo_habitacion ASC;`;

    const resultado = await conexion.query(consultaFinal, valores);
    const registros = resultado.rows;

    const filasTablaHTML = registros.map(h => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 8px; font-size: 12px; color: #334155;">Hab. ${h.clave}</td>
        <td style="padding: 10px 8px; font-size: 12px; color: #0f172a; font-weight: 600;">${h.tipo_habitacion}</td>
        <td style="padding: 10px 8px; font-size: 12px; color: #64748b;">Piso ${h.piso}</td>
        <td style="padding: 10px 8px; font-size: 12px; color: #2563eb; font-weight: 600;">${h.estado}</td>
        <td style="padding: 10px 8px; font-size: 12px; color: #0f172a; text-align: right;">$${parseFloat(h.precio_base || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'inorygranda@gmail.com',
        pass: process.env.EMAIL_PASS || 'jael cwdx lyfe vivl'
      }
    });

    const htmlContenido = `
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 24px; font-family: sans-serif; color: #1e293b; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; text-transform: uppercase;">Informe Operativo de Habitaciones</h2>
        <p>Reporte consolidado del estado de habitaciones (Filtros aplicados).</p>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #cbd5e1; text-align: left;">
              <th style="padding: 8px;">Hab.</th>
              <th style="padding: 8px;">Tipo</th>
              <th style="padding: 8px;">Piso</th>
              <th style="padding: 8px;">Estado</th>
              <th style="padding: 8px; text-align: right;">Tarifa Base</th>
            </tr>
          </thead>
          <tbody>
            ${filasTablaHTML}
          </tbody>
        </table>
      </div>
    `;

    await transporter.sendMail({
      from: '"Sistema Hotelero IUJO" <no-reply@hotel.com>',
      to: correo_destino,
      subject: `Informe Operativo de Habitaciones - ${new Date().toLocaleDateString()}`,
      html: htmlContenido
    });

    return respuesta.status(200).json({ mensaje: 'Reporte enviado por correo exitosamente.' });
  } catch (error) {
    console.error('Error al enviar correo de habitaciones:', error);
    return respuesta.status(500).json({ mensaje: 'Error al intentar despachar el correo electrónico.' });
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

  // Prevenir marcarla como Ocupada al crearla manualmente
  const estadoFinal = estado === 'Ocupada' ? 'Disponible' : (estado || 'Disponible');

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    const consultaSQL = `
      INSERT INTO habitacion (codigo_habitacion, id_tipo_habitacion, piso, capacidad, estado, amenidades)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const resultado = await cliente.query(consultaSQL, [
      codigo_habitacion,
      id_tipo_habitacion,
      piso.trim(),
      capacidad,
      estadoFinal,
      amenidades.trim()
    ]);

    const tipoHabRes = await cliente.query('SELECT nombre_tipo FROM tipo_habitacion WHERE id_tipo_habitacion = $1', [id_tipo_habitacion]);
    const nombreTipo = tipoHabRes.rows[0]?.nombre_tipo || 'Estándar';

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    await cliente.query('COMMIT');

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Habitaciones', 
      `Registró la habitación N° ${codigo_habitacion} (Tipo: ${nombreTipo}, Piso: ${piso.trim()}, Capacidad: ${capacidad} personas)`
    );

    return respuesta.status(201).json({
      mensaje: 'Habitación registrada exitosamente.',
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al registrar habitación:', error);

    if (error.code === '23505') {
      return respuesta.status(400).json({ 
        mensaje: 'El número o código de habitación ya se encuentra registrado.' 
      });
    }

    return respuesta.status(500).json({ 
      mensaje: 'Error interno al intentar guardar la habitación.' 
    });
  } finally {
    cliente.release();
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

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    const habAntiguaRes = await cliente.query(`
      SELECT h.*, th.nombre_tipo 
      FROM habitacion h
      JOIN tipo_habitacion th ON h.id_tipo_habitacion = th.id_tipo_habitacion
      WHERE h.codigo_habitacion = $1
    `, [id]);

    if (habAntiguaRes.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'La habitación a actualizar no existe.' });
    }

    const habAntigua = habAntiguaRes.rows[0];

    // Mantener el estado actual si la habitación está Ocupada
    let estadoAplicar = estado || 'Disponible';
    if (habAntigua.estado === 'Ocupada') {
      estadoAplicar = 'Ocupada';
    } else if (estadoAplicar === 'Ocupada') {
      estadoAplicar = 'Disponible'; // No se permite pasar manualmente a Ocupada sin check-in de reserva
    }

    const tipoHabRes = await cliente.query('SELECT nombre_tipo FROM tipo_habitacion WHERE id_tipo_habitacion = $1', [id_tipo_habitacion]);
    const nombreTipoNuevo = tipoHabRes.rows[0]?.nombre_tipo || 'Estándar';

    const consultaSQL = `
      UPDATE habitacion
      SET id_tipo_habitacion = $1, piso = $2, capacidad = $3, estado = $4, amenidades = $5
      WHERE codigo_habitacion = $6
      RETURNING *;
    `;
    const resultado = await cliente.query(consultaSQL, [
      id_tipo_habitacion,
      piso.trim(),
      capacidad,
      estadoAplicar,
      amenidades.trim(),
      id
    ]);

    let cambios = [];
    if (habAntigua.nombre_tipo !== nombreTipoNuevo) cambios.push(`tipo de "${habAntigua.nombre_tipo}" a "${nombreTipoNuevo}"`);
    if (String(habAntigua.piso) !== String(piso.trim())) cambios.push(`piso de "${habAntigua.piso}" a "${piso.trim()}"`);
    if (Number(habAntigua.capacidad) !== Number(capacidad)) cambios.push(`capacidad de ${habAntigua.capacidad} a ${capacidad}`);
    if (String(habAntigua.estado) !== String(estadoAplicar)) cambios.push(`estado de "${habAntigua.estado}" a "${estadoAplicar}"`);

    const detalleCambios = cambios.length > 0 ? cambios.join(', ') : 'actualizó las amenidades o detalles';

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    await cliente.query('COMMIT');

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Habitaciones', 
      `Modificó los datos de la habitación N° ${id}: ${detalleCambios}`
    );

    return respuesta.status(200).json({ 
      mensaje: 'Habitación actualizada correctamente.',
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al actualizar la habitación ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al actualizar la habitación.' });
  } finally {
    cliente.release();
  }
};

const cambiarEstadoHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { estado } = peticion.body;

  // Solo se permiten cambios operativos/mantenimiento desde este módulo
  const estadosValidos = ['Disponible', 'Sucia', 'Fuera de servicio'];

  if (!estado || !estadosValidos.includes(estado)) {
    return respuesta.status(400).json({ 
      mensaje: 'Estado no válido. El estado Ocupada solo se gestiona mediante el módulo de Reservas (Check-in / Check-out).' 
    });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    const habRes = await cliente.query('SELECT estado FROM habitacion WHERE codigo_habitacion = $1', [id]);
    if (habRes.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'Habitación no encontrada.' });
    }

    if (habRes.rows[0].estado === 'Ocupada') {
      await cliente.query('ROLLBACK');
      return respuesta.status(400).json({ 
        mensaje: 'La habitación está actualmente Ocupada. Para realizar Check-out diríjase al módulo de Reservas.' 
      });
    }

    const consultaSQL = `
      UPDATE habitacion
      SET estado = $1
      WHERE codigo_habitacion = $2
      RETURNING *;
    `;

    const resultado = await cliente.query(consultaSQL, [estado, id]);

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    await cliente.query('COMMIT');

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Habitaciones', 
      `Cambió el estado operativo de la habitación N° ${id} a "${estado}"`
    );

    return respuesta.status(200).json({
      mensaje: `Habitación marcada como ${estado}.`,
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al cambiar estado de habitación ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al cambiar el estado de la habitación.' });
  } finally {
    cliente.release();
  }
};

const eliminarHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    const consultaSQL = `
      DELETE FROM habitacion
      WHERE codigo_habitacion = $1
      RETURNING *;
    `;

    const resultado = await cliente.query(consultaSQL, [id]);

    if (resultado.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'La habitación a eliminar no existe.' });
    }

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    await cliente.query('COMMIT');

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Habitaciones', 
      `Eliminó permanentemente la habitación N° ${id}`
    );

    return respuesta.status(200).json({
      mensaje: 'Habitación eliminada correctamente.',
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al eliminar la habitación ID ${id}:`, error);

    if (error.code === '23503') {
      return respuesta.status(400).json({
        mensaje: 'No se puede eliminar la habitación porque tiene reservas o registros asociados.'
      });
    }

    return respuesta.status(500).json({ mensaje: 'Error al intentar eliminar la habitación.' });
  } finally {
    cliente.release();
  }
};

module.exports = {
  obtenerHabitaciones,
  obtenerHabitacionPorId,
  crearHabitacion,
  actualizarHabitacion,
  cambiarEstadoHabitacion,
  enviarReporteHabitacionesCorreo,
  obtenerReporteHabitaciones,
  eliminarHabitacion
};