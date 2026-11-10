const conexion = require('../config/conexion');
const bcrypt = require('bcrypt');
const axios = require('axios');
const { registrarAuditoria } = require('./controlador_auditoria');
const nodemailer = require('nodemailer');

const enviarReporteEmergenciaCorreo = async (peticion, respuesta) => {
  const { correo_destino, estado_seguro, piso, busqueda } = peticion.body;

  if (!correo_destino || !correo_destino.trim()) {
    return respuesta.status(400).json({ mensaje: 'Debe especificar un correo electrónico de destino.' });
  }

  try {
    const consultaSQL = `
      SELECT 
        h.id_huesped,
        h.nombre,
        COALESCE(h.num_documento, 'S/D') AS num_documento,
        r.codigo_habitacion,
        COALESCE(hab.piso, 'S/P') AS piso,
        h.telefono
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      LEFT JOIN habitacion hab ON r.codigo_habitacion = hab.codigo_habitacion
      WHERE r.estado = 'CHECKIN'
      ORDER BY r.codigo_habitacion ASC;
    `;
    const resultado = await conexion.query(consultaSQL);
    const registros = resultado.rows;

    const filasTablaHTML = registros.map((h, i) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 8px; font-size: 12px; color: #334155;">${i + 1}</td>
        <td style="padding: 8px; font-size: 12px; font-weight: 600;">${h.nombre}</td>
        <td style="padding: 8px; font-size: 12px;">Hab. ${h.codigo_habitacion}</td>
        <td style="padding: 8px; font-size: 12px;">Piso ${h.piso}</td>
        <td style="padding: 8px; font-size: 12px;">${h.telefono || 'N/A'}</td>
      </tr>
    `).join('');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'inorygranda@gmail.com',
        pass: process.env.EMAIL_PASS || 'jael cwdx lyfe vivl'
      }
    });

    await transporter.sendMail({
      from: '"Sistema Hotelero IUJO" <no-reply@hotel.com>',
      to: correo_destino,
      subject: `Reporte de Evacuación y Conteo de Huéspedes - ${new Date().toLocaleDateString()}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 24px; font-family: sans-serif; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="font-size: 16px; font-weight: 700; color: #dc2626; text-transform: uppercase;">Reporte de Emergencia y Evacuación</h2>
          <p>Listado oficial de huéspedes activos durante el protocolo de seguridad.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
            <thead>
              <tr style="border-bottom: 2px solid #cbd5e1; text-align: left;">
                <th style="padding: 8px;">#</th>
                <th style="padding: 8px;">Huésped</th>
                <th style="padding: 8px;">Habitación</th>
                <th style="padding: 8px;">Piso</th>
                <th style="padding: 8px;">Teléfono</th>
              </tr>
            </thead>
            <tbody>
              ${filasTablaHTML}
            </tbody>
          </table>
        </div>
      `
    });

    return respuesta.status(200).json({ mensaje: 'Reporte de emergencia enviado por correo exitosamente.' });
  } catch (error) {
    console.error('Error al enviar correo de emergencia:', error);
    return respuesta.status(500).json({ mensaje: 'Error al intentar despachar el correo electrónico.' });
  }
};

const obtenerHuespedesActivosEmergencia = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        h.id_huesped,
        h.nombre,
        COALESCE(h.num_documento, 'S/D') AS num_documento,
        r.codigo_habitacion,
        COALESCE(hab.piso, 'S/P') AS piso,
        h.telefono,
        h.correo,
        r.estado AS estado_reserva
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      LEFT JOIN habitacion hab ON r.codigo_habitacion = hab.codigo_habitacion
      WHERE r.estado = 'CHECKIN'
      ORDER BY r.codigo_habitacion ASC;
    `;

    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener huéspedes activos:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar los huéspedes en el hotel.' });
  }
};

const enviarMensajeMasivoAlerta = async (peticion, respuesta) => {
  const { mensaje, id_usuario } = peticion.body;

  if (!mensaje || !mensaje.trim()) {
    return respuesta.status(400).json({ mensaje: 'El mensaje de alerta no puede estar vacío.' });
  }

  try {
    const tokenBot = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_CHAT_ID; // Chat de la central / admin

    const usuarioRes = await conexion.query('SELECT nombre FROM usuario WHERE id_usuario = $1', [id_usuario || 1]);
    const nombreUsuario = usuarioRes.rows[0]?.nombre || 'Administrador';

    // 1. Consultar huéspedes con CHECKIN uniendo r.id_telegram Y ht.id_telegram de la tabla huesped_telegram
    const consultaSQL = `
      SELECT 
        h.id_huesped,
        h.nombre,
        r.codigo_habitacion,
        COALESCE(hab.piso, 'S/P') AS piso,
        COALESCE(h.telefono, 'Sin Teléfono') AS telefono,
        COALESCE(r.id_telegram, ht.id_telegram) AS id_telegram
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      LEFT JOIN habitacion hab ON r.codigo_habitacion = hab.codigo_habitacion
      LEFT JOIN huesped_telegram ht ON h.id_huesped = ht.id_huesped
      WHERE r.estado = 'CHECKIN'
      ORDER BY r.codigo_habitacion ASC;
    `;
    const resultado = await conexion.query(consultaSQL);
    const huespedes = resultado.rows;

    let listaHuespedesTexto = '';
    if (huespedes.length > 0) {
      listaHuespedesTexto = huespedes
        .map((h, index) => `  *${index + 1}.* Hab. *${h.codigo_habitacion}* (Piso ${h.piso}) - ${h.nombre} ${h.id_telegram ? '📱 (Telegram)' : ''}`)
        .join('\n');
    } else {
      listaHuespedesTexto = '  _No hay huéspedes registrados en CHECKIN actualmente._';
    }

    const fechaHora = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });
    const urlApiTelegram = `https://api.telegram.org/bot${tokenBot}/sendMessage`;

    // 2. Enviar reporte administrativo
    const textoReporteAdmin = 
      `*[ REPORTE OPERATIVO DE EMERGENCIA ]*\n` +
      `----------------------------------------\n` +
      `*Emitido por:* ${nombreUsuario}\n` +
      `*Fecha y Hora:* ${fechaHora}\n` +
      `*Estado:* ALERTA DE SEGURIDAD ACTIVADA\n\n` +
      `*Instrucción de Protocolo:* \n` +
      `_"${mensaje.trim()}"_\n\n` +
      `*Censo de Evacuación:* ${huespedes.length} huésped(es) en total.\n` +
      `${listaHuespedesTexto}\n` +
      `----------------------------------------`;

    if (adminChatId) {
      await axios.post(urlApiTelegram, {
        chat_id: adminChatId,
        text: textoReporteAdmin,
        parse_mode: 'Markdown'
      });
    }

    // 3. Enviar advertencia individual a cada huésped con Telegram
    let huespedesNotificados = 0;
    for (const h of huespedes) {
      if (h.id_telegram) {
        const textoAdvertenciaHuesped = 
          `🚨 *¡ALERTA DE EMERGENCIA EN EL HOTEL!* 🚨\n\n` +
          `Estimado/a *${h.nombre}* (Habitación N° ${h.codigo_habitacion}):\n\n` +
          `_${mensaje.trim()}_\n\n` +
          `Por favor, mantenga la calma, siga las instrucciones del personal y diríjase de inmediato a la salida de emergencia más cercana. Su seguridad es nuestra prioridad.`;

        try {
          await axios.post(urlApiTelegram, {
            chat_id: h.id_telegram,
            text: textoAdvertenciaHuesped,
            parse_mode: 'Markdown'
          });
          huespedesNotificados++;
        } catch (errHuesped) {
          console.error(`No se pudo enviar la advertencia al huésped ${h.nombre} (Telegram ID: ${h.id_telegram}):`, errHuesped.message);
        }
      }
    }

    const actualizarLogSQL = `
      UPDATE emergencia_log 
      SET mensaje_emitido = $1 
      WHERE estado = 'ALERTA' 
      AND id_emergencia = (SELECT MAX(id_emergencia) FROM emergencia_log WHERE estado = 'ALERTA');
    `;
    await conexion.query(actualizarLogSQL, [mensaje.trim()]);

    await registrarAuditoria(
      id_usuario || 1, 
      8, 
      `El usuario ${nombreUsuario} activó alerta masiva: Reporte enviado a administración y ${huespedesNotificados} huéspedes notificados vía Telegram.`
    );

    return respuesta.status(200).json({
      mensaje: `Alerta transmitida con éxito. Reporte enviado a la central y advertencia enviada a ${huespedesNotificados} de ${huespedes.length} huéspedes con Telegram activo.`
    });
  } catch (error) {
    console.error('Error al enviar mensajes masivos de emergencia:', error.response?.data || error.message);
    return respuesta.status(500).json({ mensaje: 'Error al conectar con la API de Telegram.' });
  }
};

const obtenerEstadoEmergencia = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT el.estado, el.mensaje_emitido, el.fecha_hora_activacion, COALESCE(u.nombre, 'Sistema') AS usuario_activo
      FROM emergencia_log el
      LEFT JOIN usuario u ON el.id_usuario = u.id_usuario
      ORDER BY el.id_emergencia DESC
      LIMIT 1;
    `;
    const resultado = await conexion.query(consultaSQL);

    if (resultado.rows.length === 0) {
      return respuesta.status(200).json({ estado: 'NORMAL' });
    }

    return respuesta.status(200).json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al obtener estado de emergencia:', error);
    return respuesta.status(200).json({ estado: 'NORMAL' });
  }
};

const activarEmergencia = async (peticion, respuesta) => {
  const { id_usuario, contrasenna_admin } = peticion.body;

  if (!id_usuario || !contrasenna_admin) {
    return respuesta.status(400).json({ mensaje: 'Faltan datos obligatorios para activar la emergencia.' });
  }

  try {
    const consultaUsuario = `
      SELECT u.id_usuario, u.nombre, u.contrasenna, r.nombre AS nombre_rol
      FROM usuario u
      JOIN rol r ON u.id_rol = r.id_rol
      WHERE u.id_usuario = $1 AND u.estado = 'ACTIVO';
    `;
    const resultadoUsuario = await conexion.query(consultaUsuario, [id_usuario]);

    if (resultadoUsuario.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Usuario no encontrado o inactivo.' });
    }

    const usuarioAccion = resultadoUsuario.rows[0];

    const consultaAdmin = `
      SELECT u.id_usuario, u.contrasenna 
      FROM usuario u
      JOIN rol r ON u.id_rol = r.id_rol
      WHERE r.nombre = 'Administrador General' AND u.estado = 'ACTIVO'
      LIMIT 1;
    `;
    const resultadoAdmin = await conexion.query(consultaAdmin);

    if (resultadoAdmin.rows.length === 0) {
      return respuesta.status(500).json({ mensaje: 'No se encontró un administrador activo en el sistema.' });
    }

    const adminSistema = resultadoAdmin.rows[0];
    const contrasennaValida = await bcrypt.compare(contrasenna_admin, adminSistema.contrasenna);
    
    if (!contrasennaValida) {
      return respuesta.status(401).json({ mensaje: 'Contraseña de administrador incorrecta.' });
    }

    const consultaLog = `
      INSERT INTO emergencia_log (id_usuario, estado, mensaje_emitido)
      VALUES ($1, 'ALERTA', 'No se ha enviado ningun mensaje')
      RETURNING *;
    `;
    const resultadoLog = await conexion.query(consultaLog, [usuarioAccion.id_usuario]);

    await registrarAuditoria(
      usuarioAccion.id_usuario, 
      'Control de emergencia', 
      `El usuario ${usuarioAccion.nombre} activó la alerta de seguridad y evacuación del sistema`
    );

    return respuesta.status(201).json({
      mensaje: 'Estado de emergencia activado y registrado exitosamente.',
      emergencia: resultadoLog.rows[0]
    });
  } catch (error) {
    console.error('Error al activar emergencia:', error);
    return respuesta.status(500).json({ mensaje: 'Error interno en el servidor.' });
  }
};

const desactivarEmergencia = async (peticion, respuesta) => {
  const { id_usuario } = peticion.body;

  if (!id_usuario) {
    return respuesta.status(400).json({ mensaje: 'ID de usuario obligatorio para normalizar el sistema.' });
  }

  try {
    const usuarioRes = await conexion.query('SELECT nombre FROM usuario WHERE id_usuario = $1', [id_usuario]);
    const nombreUsuario = usuarioRes.rows[0]?.nombre || 'Usuario';

    const consultaLog = `
      INSERT INTO emergencia_log (id_usuario, estado, mensaje_emitido)
      VALUES ($1, 'NORMAL', 'Sistema normalizado y protocolos finalizados')
      RETURNING *;
    `;
    const resultadoLog = await conexion.query(consultaLog, [id_usuario]);

    await registrarAuditoria(
      id_usuario, 
      'Control de emergencia', 
      `El usuario ${nombreUsuario} normalizó el sistema y finalizó los protocolos de emergencia`
    );

    return respuesta.status(200).json({
      mensaje: 'Sistema normalizado exitosamente.',
      emergencia: resultadoLog.rows[0]
    });
  } catch (error) {
    console.error('Error al desactivar emergencia:', error);
    return respuesta.status(500).json({ mensaje: 'Error interno en el servidor.' });
  }
};

const registrarMarcajeHuespedSeguro = async (peticion, respuesta) => {
  const { id_usuario, id_huesped, seguro } = peticion.body;

  try {
    const usuarioRes = await conexion.query('SELECT nombre FROM usuario WHERE id_usuario = $1', [id_usuario || 1]);
    const nombreUsuario = usuarioRes.rows[0]?.nombre || 'Usuario';

    const huespedRes = await conexion.query(`
      SELECT h.nombre, r.codigo_habitacion 
      FROM huesped h 
      JOIN reserva r ON h.id_huesped = r.id_huesped 
      WHERE h.id_huesped = $1 AND r.estado = 'CHECKIN'
      LIMIT 1;
    `, [id_huesped]);

    const nombreHuesped = huespedRes.rows[0]?.nombre || `Huésped ID ${id_huesped}`;
    const habitacion = huespedRes.rows[0]?.codigo_habitacion || 'S/N';

    const accionTexto = seguro 
      ? `marcó al huésped "${nombreHuesped}" (Hab. ${habitacion}) como SEGURO/EVACUADO` 
      : `desmarcó al huésped "${nombreHuesped}" (Hab. ${habitacion}) quedando PENDIENTE`;

    await registrarAuditoria(
      id_usuario || 1,
      8, 
      `El usuario ${nombreUsuario} ${accionTexto}`
    );

    return respuesta.status(200).json({ mensaje: 'Marcaje registrado en auditoría con éxito.' });
  } catch (error) {
    console.error('Error al registrar marcaje de huésped:', error);
    return respuesta.status(500).json({ mensaje: 'Error al registrar auditoría de huésped.' });
  }
};

module.exports = {
  obtenerHuespedesActivosEmergencia,
  obtenerEstadoEmergencia,
  activarEmergencia,
  desactivarEmergencia,
  enviarMensajeMasivoAlerta,
  enviarReporteEmergenciaCorreo,
  registrarMarcajeHuespedSeguro 
};