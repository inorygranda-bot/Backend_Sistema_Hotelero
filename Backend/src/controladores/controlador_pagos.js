const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');
const nodemailer = require('nodemailer');

const obtenerPagos = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        p.id_pago,
        p.codigo_reserva,
        p.id_usuario,
        u.nombre AS nombre_usuario,
        p.metodo_pago,
        p.fecha_pago,
        p.moneda,
        p.monto,
        p.descripcion,
        tb.num_referencia,
        b_dest.nombre_banco AS banco_destino,
        r.id_huesped,
        h.nombre AS nombre_huesped
      FROM pago p
      JOIN reserva r ON p.codigo_reserva = r.codigo_reserva
      JOIN huesped h ON r.id_huesped = h.id_huesped
      JOIN usuario u ON p.id_usuario = u.id_usuario
      LEFT JOIN transaccion_bancaria tb ON p.id_pago = tb.id_pago
      LEFT JOIN banco b_dest ON tb.id_banco_destino = b_dest.id_banco
      ORDER BY p.id_pago DESC;
    `;
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener la lista de pagos:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar los pagos en la base de datos.' });
  }
};

const enviarReportePagosCorreo = async (peticion, respuesta) => {
  const { correo_destino, metodo_pago, moneda, banco, estado, fecha_desde, fecha_hasta } = peticion.body;

  if (!correo_destino || !correo_destino.trim()) {
    return respuesta.status(400).json({ mensaje: 'Debe especificar un correo electrónico de destino.' });
  }

  try {
    let consultaSQL = `
      SELECT p.*, h.nombre AS nombre_huesped, b_dest.nombre_banco AS banco_destino
      FROM pago p
      JOIN reserva r ON p.codigo_reserva = r.codigo_reserva
      JOIN huesped h ON r.id_huesped = h.id_huesped
      LEFT JOIN transaccion_bancaria tb ON p.id_pago = tb.id_pago
      LEFT JOIN banco b_dest ON tb.id_banco_destino = b_dest.id_banco
      WHERE 1=1
    `;
    const valores = [];
    let idx = 1;

    if (metodo_pago && metodo_pago !== 'TODOS') {
      consultaSQL += ` AND p.metodo_pago ILIKE $${idx}`;
      valores.push(metodo_pago);
      idx++;
    }
    if (moneda && moneda !== 'TODAS') {
      consultaSQL += ` AND p.moneda = $${idx}`;
      valores.push(moneda);
      idx++;
    }
    if (banco && banco !== 'TODOS') {
      consultaSQL += ` AND b_dest.nombre_banco ILIKE $${idx}`;
      valores.push(banco);
      idx++;
    }
    if (fecha_desde) {
      consultaSQL += ` AND p.fecha_pago >= $${idx}`;
      valores.push(fecha_desde);
      idx++;
    }
    if (fecha_hasta) {
      consultaSQL += ` AND p.fecha_pago <= $${idx}`;
      valores.push(fecha_hasta);
      idx++;
    }

    consultaSQL += ` ORDER BY p.id_pago DESC;`;
    const resultado = await conexion.query(consultaSQL, valores);
    const registros = resultado.rows;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'inorygranda@gmail.com',
        pass: process.env.EMAIL_PASS || 'jael cwdx lyfe vivl'
      }
    });

    const filasHTML = registros.map(p => `
  <tr>
    <td style="padding: 8px; border-bottom: 1px solid #ddd;">#PAG-${p.id_pago}</td>
    <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: 600;">N° ${p.codigo_reserva}</td> <!-- AGREGAR ESTO -->
    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${p.nombre_huesped}</td>
    <td style="padding: 8px; border-bottom: 1px solid #ddd;">${p.metodo_pago}</td>
    <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(p.monto).toFixed(2)} ${p.moneda}</td>
  </tr>
`).join('');

    await transporter.sendMail({
      from: '"Sistema Hotelero" <no-reply@hotel.com>',
      to: correo_destino,
      subject: `Reporte de Pagos e Ingresos - ${new Date().toLocaleDateString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
          <h2>Reporte de Pagos y Transacciones</h2>
          <p>Total de registros filtrados: <strong>${registros.length}</strong></p>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8fafc; text-align: left;">
                <th style="padding: 8px;">ID</th>
                <th style="padding: 8px;">N° Reserva</th>
                <th style="padding: 8px;">Huésped</th>
                <th style="padding: 8px;">Método</th>
                <th style="padding: 8px; text-align: right;">Monto</th>
              </tr>
            </thead>
            <tbody>${filasHTML}</tbody>
          </table>
        </div>
      `
    });

    return respuesta.status(200).json({ mensaje: 'Reporte enviado por correo exitosamente.' });
  } catch (error) {
    console.error('Error al enviar correo:', error);
    return respuesta.status(500).json({ mensaje: 'Error al enviar el correo electrónico.' });
  }
};

const obtenerPagoPorId = async (peticion, respuesta) => {
  const { id } = peticion.params;
  try {
    const consultaSQL = `
      SELECT p.*, tb.num_referencia, b_dest.nombre_banco AS banco_destino
      FROM pago p
      LEFT JOIN transaccion_bancaria tb ON p.id_pago = tb.id_pago
      LEFT JOIN banco b_dest ON tb.id_banco_destino = b_dest.id_banco
      WHERE p.id_pago = $1;
    `;
    const resultado = await conexion.query(consultaSQL, [id]);
    if (resultado.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Pago no encontrado.' });
    }
    return respuesta.status(200).json(resultado.rows[0]);
  } catch (error) {
    console.error(`Error al obtener el pago ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al obtener los datos del pago.' });
  }
};

const crearPago = async (peticion, respuesta) => {
  const {
    codigo_reserva,
    metodo_pago,
    moneda,
    monto,
    id_banco_destino,
    num_referencia,
    descripcion,
    tasa_bcv
  } = peticion.body;

  if (!codigo_reserva || !metodo_pago || !moneda || monto === undefined || monto === '' || !descripcion) {
    return respuesta.status(400).json({ mensaje: 'Todos los campos obligatorios del pago deben ser completados.' });
  }

  if (isNaN(monto) || Number(monto) <= 0) {
    return respuesta.status(400).json({ mensaje: 'El monto del pago debe ser un número mayor a cero.' });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    const consultaReserva = await cliente.query(`
      SELECT r.codigo_reserva, h.nombre AS nombre_huesped 
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      WHERE r.codigo_reserva = $1
    `, [codigo_reserva]);

    if (consultaReserva.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'La reserva seleccionada no existe.' });
    }

    const nombreHuesped = consultaReserva.rows[0].nombre_huesped;
    let montoEnUSD = Number(monto);
    const monedaUpper = moneda.toUpperCase();
    const tasaOficial = Number(tasa_bcv) || 872.39;

    if (monedaUpper === 'VES') {
      montoEnUSD = Number(monto) / tasaOficial;
    }

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    // 1. Insertar exclusivamente en la tabla 'pago' respetando su esquema real
    const consultaInsertarPago = `
      INSERT INTO pago (
        codigo_reserva, 
        id_usuario, 
        metodo_pago, 
        moneda, 
        monto, 
        descripcion
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const resultadoPago = await cliente.query(consultaInsertarPago, [
      codigo_reserva,
      idUsuarioResponsable,
      metodo_pago.trim(),
      moneda.trim(),
      monto,
      descripcion.trim()
    ]);

    const idPagoGenerado = resultadoPago.rows[0]?.id_pago;

    // 2. Si seleccionó un banco, registrar la transacción bancaria asociada
    if (id_banco_destino && idPagoGenerado) {
      await cliente.query(`
        INSERT INTO transaccion_bancaria (id_pago, id_banco_origen, id_banco_destino, num_referencia)
        VALUES ($1, $2, $3, $4);
      `, [
        idPagoGenerado,
        id_banco_destino,
        id_banco_destino,
        num_referencia ? num_referencia.trim() : `REF-${Date.now()}`
      ]);
    }

    // 3. Actualizar el acumulado pagado en la reserva
    const consultaActualizarReserva = `
      UPDATE reserva
      SET monto_pagado = monto_pagado + $1
      WHERE codigo_reserva = $2
      RETURNING *;
    `;

    await cliente.query(consultaActualizarReserva, [montoEnUSD, codigo_reserva]);

    await cliente.query('COMMIT');

    await registrarAuditoria(
      idUsuarioResponsable,
      4,
      `Registró un pago de ${monto} ${moneda.trim()} (${metodo_pago.trim()}) para la reserva N° ${codigo_reserva} del huésped "${nombreHuesped}"`
    );

    return respuesta.status(201).json({
      mensaje: 'Pago registrado exitosamente y saldo convertido a USD.',
      pago: resultadoPago.rows[0]
    });

  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al registrar el pago:', error);
    return respuesta.status(500).json({ mensaje: 'Error interno al intentar guardar el pago en la base de datos.' });
  } finally {
    cliente.release();
  }
};

const eliminarPago = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    const consultaPago = await cliente.query(`
      SELECT p.codigo_reserva, p.monto, p.moneda, h.nombre AS nombre_huesped
      FROM pago p
      JOIN reserva r ON p.codigo_reserva = r.codigo_reserva
      JOIN huesped h ON r.id_huesped = h.id_huesped
      WHERE p.id_pago = $1
    `, [id]);

    if (consultaPago.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'El pago a eliminar no existe.' });
    }

    const { codigo_reserva, monto, moneda, nombre_huesped } = consultaPago.rows[0];
    let montoEnUSD = Number(monto);
    if (moneda.toUpperCase() === 'VES') {
      montoEnUSD = Number(monto) / 872.39;
    }

    const resultadoEliminar = await cliente.query('DELETE FROM pago WHERE id_pago = $1 RETURNING *;', [id]);

    await cliente.query(
      'UPDATE reserva SET monto_pagado = GREATEST(0, monto_pagado - $1) WHERE codigo_reserva = $2;',
      [montoEnUSD, codigo_reserva]
    );

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await cliente.query('COMMIT');

    await registrarAuditoria(
      idUsuarioResponsable,
      4,
      `Eliminó el registro de pago de ${monto} ${moneda} correspondiente a la reserva N° ${codigo_reserva} de "${nombre_huesped}"`
    );

    return respuesta.status(200).json({
      mensaje: 'Pago eliminado correctamente y saldo de reserva actualizado.',
      pago: resultadoEliminar.rows[0]
    });

  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al eliminar el pago ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al intentar eliminar el pago.' });
  } finally {
    cliente.release();
  }
};

module.exports = {
  obtenerPagos,
  obtenerPagoPorId,
  crearPago,
  enviarReportePagosCorreo,
  eliminarPago
};