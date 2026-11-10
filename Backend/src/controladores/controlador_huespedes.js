const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');
const nodemailer = require('nodemailer');

const enviarReporteHuespedesCorreo = async (peticion, respuesta) => {
  const { correo_destino, estado, busqueda } = peticion.body;

  if (!correo_destino || !correo_destino.trim()) {
    return respuesta.status(400).json({ mensaje: 'Debe especificar un correo electrónico de destino.' });
  }

  try {
    let consultaSQL = `
      SELECT 
        h.id_huesped,
        h.tipo_documento,
        h.num_documento,
        h.nombre,
        h.telefono,
        h.correo,
        h.estado,
        COUNT(r.codigo_reserva) AS total_reservas,
        COALESCE(SUM(r.monto_pagado), 0.00) AS total_gastado
      FROM huesped h
      LEFT JOIN reserva r ON h.id_huesped = r.id_huesped
      WHERE 1=1
    `;
    
    const valores = [];
    let contadorParametros = 1;

    if (estado && estado !== 'TODOS') {
      consultaSQL += ` AND h.estado = $${contadorParametros}`;
      valores.push(estado);
      contadorParametros++;
    }

    if (busqueda && busqueda.trim() !== '') {
      consultaSQL += ` AND (h.nombre ILIKE $${contadorParametros} OR h.num_documento ILIKE $${contadorParametros} OR h.correo ILIKE $${contadorParametros})`;
      valores.push(`%${busqueda.trim()}%`);
      contadorParametros++;
    }

    consultaSQL += ` GROUP BY h.id_huesped ORDER BY h.id_huesped DESC;`;
    const resultado = await conexion.query(consultaSQL, valores);
    const registros = resultado.rows;

    const totalHuespedes = registros.length;
    const totalRecaudado = registros.reduce((acc, curr) => acc + parseFloat(curr.total_gastado || 0), 0);

    // Filas con anchos controlados y saltos de línea para evitar desbordamiento
    const filasTablaHTML = registros.map(h => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 8px; font-size: 12px; color: #334155; width: 25%; word-break: break-word;">${h.tipo_documento}-${h.num_documento}</td>
        <td style="padding: 10px 8px; font-size: 12px; color: #0f172a; font-weight: 600; width: 35%; word-break: break-word;">${h.nombre}</td>
        <td style="padding: 10px 8px; font-size: 12px; color: #64748b; width: 20%; word-break: break-word;">${h.telefono || 'N/A'}</td>
        <td style="padding: 10px 8px; font-size: 12px; color: #0f172a; width: 20%; text-align: right; word-break: break-word;">$${parseFloat(h.total_gastado || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'inorygranda@gmail.com',
        pass: process.env.EMAIL_PASS || 'jael cwdx lyfe vivl'
      }
    });

    // Diseño minimalista, ejecutivo, sin emojis y con estructura fluida de ancho fijo
    const htmlContenido = `
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; font-size: 13px; line-height: 1.5; border: 1px solid #e2e8f0; border-radius: 8px;">
        
        <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
          <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; letter-spacing: 0.5px; text-transform: uppercase;">Informe de Huéspedes</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Sistema de Gestión Hotelera</p>
        </div>

        <p style="margin: 0 0 16px 0; color: #334155;">Estimado, reciba un cordial saludo</p>
        <p style="margin: 0 0 16px 0; color: #334155;">A continuación se detalla el reporte de huéspedes.</p>
        
        <div style="background-color: #f8fafc; padding: 14px; border-radius: 6px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-size: 12px;">Total Registros:</td>
              <td style="padding: 4px 0; color: #0f172a; font-weight: 600; text-align: right; font-size: 12px;">${totalHuespedes}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-size: 12px;">Filtro de Estado:</td>
              <td style="padding: 4px 0; color: #0f172a; font-weight: 600; text-align: right; font-size: 12px;">${estado}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-size: 12px;">Acumulado Histórico:</td>
              <td style="padding: 4px 0; color: #0f172a; font-weight: 600; text-align: right; font-size: 12px;">$${totalRecaudado.toFixed(2)} USD</td>
            </tr>
          </table>
        </div>

        <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Detalle de Huéspedes</h3>
        
        <div style="width: 100%; overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <thead>
              <tr style="border-bottom: 2px solid #cbd5e1; text-align: left;">
                <th style="padding: 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; width: 25%;">Documento</th>
                <th style="padding: 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; width: 35%;">Nombre</th>
                <th style="padding: 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; width: 20%;">Teléfono</th>
                <th style="padding: 8px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; width: 20%; text-align: right;">Gastado</th>
              </tr>
            </thead>
            <tbody>
              ${filasTablaHTML}
            </tbody>
          </table>
        </div>
        <p style="margin: 20px 0 0 0; font-size: 12px; color: #64748b;">Este informe es generado automáticamente por el Sistema Hotelero. Por favor, no responda a este correo.</p>
      </div>
    `;

    await transporter.sendMail({
      from: '"Sistema Hotelero" <no-reply@hotel.com>',
      to: correo_destino,
      subject: `Informe de Huéspedes - ${new Date().toLocaleDateString()}`,
      html: htmlContenido
    });

    return respuesta.status(200).json({ mensaje: 'Reporte enviado por correo exitosamente.' });
  } catch (error) {
    console.error('Error al enviar correo:', error);
    return respuesta.status(500).json({ mensaje: 'Error al intentar enviar el correo electrónico.' });
  }
};

const obtenerHuespedes = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        h.id_huesped,
        h.tipo_documento,
        h.num_documento,
        h.nombre,
        h.telefono,
        h.correo,
        h.estado
      FROM huesped h
      ORDER BY h.id_huesped DESC;
    `;
    
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener huéspedes:', error);
    return respuesta.status(500).json({ 
      mensaje: 'Error al consultar la lista de huéspedes en la base de datos.' 
    });
  }
};

const obtenerHuespedPorId = async (peticion, respuesta) => {
  const { id } = peticion.params;

  try {
    const consultaSQL = `
      SELECT 
        h.id_huesped,
        h.tipo_documento,
        h.num_documento,
        h.nombre,
        h.telefono,
        h.correo,
        h.estado
      FROM huesped h
      WHERE h.id_huesped = $1;
    `;

    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Huésped no encontrado.' });
    }

    return respuesta.status(200).json(resultado.rows[0]);
  } catch (error) {
    console.error(`Error al obtener el huésped ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al obtener los datos del huésped.' });
  }
};

const crearHuesped = async (peticion, respuesta) => {
  const { tipo_documento, num_documento, nombre, telefono, correo, estado } = peticion.body;

  // Validación estricta incluyendo el teléfono
  if (!nombre || !nombre.trim() || !tipo_documento || !num_documento || !num_documento.trim() || !correo || !correo.trim() || !telefono || !telefono.trim()) {
    return respuesta.status(400).json({ 
      mensaje: 'Todos los campos obligatorios (Nombre, Documento, Correo y Teléfono) deben ser completados.' 
    });
  }

  try {
    const consultaHuesped = `
      INSERT INTO huesped (tipo_documento, num_documento, nombre, telefono, correo, estado)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_huesped;
    `;
    const resultadoHuesped = await conexion.query(consultaHuesped, [
      tipo_documento,
      num_documento.trim(),
      nombre.trim(),
      telefono.trim(),
      correo.trim(),
      estado || 'ACTIVO'
    ]);

    const idNuevoHuesped = resultadoHuesped.rows[0].id_huesped;
    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Huéspedes', 
      `Registró al huésped "${nombre.trim()}" (${tipo_documento}-${num_documento.trim()})`
    );

    return respuesta.status(201).json({
      mensaje: 'Huésped registrado exitosamente.',
      id_huesped: idNuevoHuesped
    });
  } catch (error) {
    console.error('Error al registrar huésped:', error);

    if (error.code === '23505') {
      return respuesta.status(400).json({ 
        mensaje: 'El número de documento o correo electrónico ya se encuentra registrado.' 
      });
    }

    return respuesta.status(500).json({ 
      mensaje: 'Error interno al intentar guardar el huésped.' 
    });
  }
};

const actualizarHuesped = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { tipo_documento, num_documento, nombre, telefono, correo, estado } = peticion.body;

  if (!nombre || !nombre.trim() || !tipo_documento || !num_documento || !num_documento.trim() || !correo || !correo.trim()) {
    return respuesta.status(400).json({ 
      mensaje: 'Por favor completa todos los campos requeridos, incluyendo el número de documento.' 
    });
  }

  try {
    const huespedAntiguoRes = await conexion.query(`
      SELECT nombre, num_documento 
      FROM huesped 
      WHERE id_huesped = $1
    `, [id]);

    if (huespedAntiguoRes.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'El huésped a actualizar no existe.' });
    }

    const nombreAntiguo = huespedAntiguoRes.rows[0].nombre;

    const consultaHuesped = `
      UPDATE huesped
      SET tipo_documento = $1, num_documento = $2, nombre = $3, telefono = $4, correo = $5, estado = $6
      WHERE id_huesped = $7;
    `;
    await conexion.query(consultaHuesped, [
      tipo_documento,
      num_documento.trim(),
      nombre.trim(),
      telefono ? telefono.trim() : '',
      correo.trim(),
      estado || 'ACTIVO',
      id
    ]);

    let cambios = [];
    if (nombreAntiguo !== nombre.trim()) cambios.push(`nombre de "${nombreAntiguo}" a "${nombre.trim()}"`);
    if (estado && estado !== 'ACTIVO') cambios.push(`estado a "${estado}"`);
    const detalleCambios = cambios.length > 0 ? cambios.join(', ') : 'actualizó sus datos generales';

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Huéspedes', 
      `Actualizó la información del huésped "${nombre.trim()}": ${detalleCambios}`
    );

    return respuesta.status(200).json({ mensaje: 'Huésped actualizado correctamente.' });
  } catch (error) {
    console.error(`Error al actualizar el huésped ID ${id}:`, error);

    if (error.code === '23505') {
      return respuesta.status(400).json({ 
        mensaje: 'El número de documento o correo ya pertenece a otro registro.' 
      });
    }

    return respuesta.status(500).json({ mensaje: 'Error al actualizar el huésped.' });
  }
};

const cambiarEstadoHuesped = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { estado } = peticion.body;

  if (!estado || !['ACTIVO', 'INACTIVO'].includes(estado)) {
    return respuesta.status(400).json({ mensaje: 'Estado no válido.' });
  }

  try {
    const huespedRes = await conexion.query('SELECT nombre FROM huesped WHERE id_huesped = $1', [id]);
    if (huespedRes.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Huésped no encontrado.' });
    }
    const nombreHuesped = huespedRes.rows[0].nombre;

    const consultaSQL = `
      UPDATE huesped 
      SET estado = $1 
      WHERE id_huesped = $2;
    `;
    await conexion.query(consultaSQL, [estado, id]);

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Huéspedes', 
      `Cambió el estado del huésped "${nombreHuesped}" a ${estado}`
    );

    return respuesta.status(200).json({ mensaje: `Huésped marcado como ${estado}.` });
  } catch (error) {
    console.error(`Error al cambiar estado del huésped ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al cambiar el estado del huésped.' });
  }
};

const eliminarHuesped = async (peticion, respuesta) => {
  const { id } = peticion.params;

  try {
    const huespedRes = await conexion.query('SELECT nombre FROM huesped WHERE id_huesped = $1', [id]);
    if (huespedRes.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'El huésped no existe.' });
    }
    const nombreHuesped = huespedRes.rows[0].nombre;

    await conexion.query('DELETE FROM huesped WHERE id_huesped = $1;', [id]);

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Huéspedes', 
      `Eliminó permanentemente al huésped "${nombreHuesped}"`
    );

    return respuesta.status(200).json({ mensaje: 'Huésped eliminado exitosamente.' });
  } catch (error) {
    console.error(`Error al eliminar huésped ID ${id}:`, error);

    if (error.code === '23503') {
      return respuesta.status(400).json({ 
        mensaje: 'No se puede eliminar el huésped porque tiene reservas registradas. En su lugar, cámbialo a estado INACTIVO.' 
      });
    }

    return respuesta.status(500).json({ mensaje: 'Error interno al intentar eliminar el huésped.' });
  }
};

const obtenerReporteHuespedes = async (peticion, respuesta) => {
  const { estado, busqueda } = peticion.query;
  
  try {
    let consultaSQL = `
      SELECT 
        h.id_huesped,
        h.tipo_documento,
        h.num_documento,
        h.nombre,
        h.telefono,
        h.correo,
        h.estado,
        COUNT(r.codigo_reserva) AS total_reservas,
        COALESCE(SUM(r.monto_pagado), 0.00) AS total_gastado
      FROM huesped h
      LEFT JOIN reserva r ON h.id_huesped = r.id_huesped
      WHERE 1=1
    `;
    
    const valores = [];
    let contadorParametros = 1;

    if (estado && estado !== 'TODOS') {
      consultaSQL += ` AND h.estado = $${contadorParametros}`;
      valores.push(estado);
      contadorParametros++;
    }

    if (busqueda && busqueda.trim() !== '') {
      consultaSQL += ` AND (h.nombre ILIKE $${contadorParametros} OR h.num_documento ILIKE $${contadorParametros} OR h.correo ILIKE $${contadorParametros})`;
      valores.push(`%${busqueda.trim()}%`);
      contadorParametros++;
    }

    consultaSQL += ` GROUP BY h.id_huesped ORDER BY h.id_huesped DESC;`;

    const resultado = await conexion.query(consultaSQL, valores);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al generar reporte de huéspedes:', error);
    return respuesta.status(500).json({ mensaje: 'Error al generar el reporte de huéspedes en la base de datos.' });
  }
};

module.exports = {
  obtenerHuespedes,
  obtenerReporteHuespedes, 
  obtenerHuespedPorId,
  crearHuesped,
  actualizarHuesped,
  cambiarEstadoHuesped,
  enviarReporteHuespedesCorreo,
  eliminarHuesped
};