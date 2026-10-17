const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');

// Obtener todos los pagos registrados con detalles de la reserva y huésped
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
        p.banco_destino,
        p.num_referencia,
        p.descripcion,
        r.id_huesped,
        h.nombre AS nombre_huesped
      FROM pago p
      JOIN reserva r ON p.codigo_reserva = r.codigo_reserva
      JOIN huesped h ON r.id_huesped = h.id_huesped
      JOIN usuario u ON p.id_usuario = u.id_usuario
      ORDER BY p.id_pago DESC;
    `;
    
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener la lista de pagos:', error);
    return respuesta.status(500).json({ 
      mensaje: 'Error al consultar los pagos en la base de datos.' 
    });
  }
};

// Obtener un pago específico por su ID
const obtenerPagoPorId = async (peticion, respuesta) => {
  const { id } = peticion.params;

  try {
    const consultaSQL = `SELECT * FROM pago WHERE id_pago = $1;`;
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

// Registrar un nuevo pago, convirtiendo la moneda si es VES y actualizando la reserva en USD
const crearPago = async (peticion, respuesta) => {
  const { 
    codigo_reserva, 
    metodo_pago, 
    moneda, 
    monto, 
    banco_destino, 
    num_referencia, 
    descripcion,
    tasa_bcv 
  } = peticion.body;

  if (!codigo_reserva || !metodo_pago || !moneda || monto === undefined || monto === '' || !descripcion) {
    return respuesta.status(400).json({ 
      mensaje: 'Todos los campos obligatorios del pago deben ser completados.' 
    });
  }

  if (isNaN(monto) || Number(monto) <= 0) {
    return respuesta.status(400).json({
      mensaje: 'El monto del pago debe ser un número mayor a cero.'
    });
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

    const consultaInsertarPago = `
      INSERT INTO pago (
        codigo_reserva, 
        id_usuario, 
        metodo_pago, 
        moneda, 
        monto, 
        banco_destino, 
        num_referencia, 
        descripcion
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const resultadoPago = await cliente.query(consultaInsertarPago, [
      codigo_reserva,
      idUsuarioResponsable,
      metodo_pago.trim(),
      moneda.trim(),
      monto,
      banco_destino ? banco_destino.trim() : null,
      num_referencia ? num_referencia.trim() : null,
      descripcion.trim()
    ]);

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
      'Finanzas', 
      `Registró un pago de ${monto} ${moneda.trim()} (${metodo_pago.trim()}) para la reserva N° ${codigo_reserva} del huésped "${nombreHuesped}"`
    );

    return respuesta.status(201).json({
      mensaje: 'Pago registrado exitosamente y saldo convertido a USD.',
      pago: resultadoPago.rows[0]
    });

  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al registrar el pago:', error);
    return respuesta.status(500).json({ 
      mensaje: 'Error interno al intentar guardar el pago en la base de datos.' 
    });
  } finally {
    cliente.release();
  }
};

// Eliminar un pago y descontar de la reserva
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
      'Finanzas', 
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
  eliminarPago
};