const conexion = require('../config/conexion');
const bcrypt = require('bcrypt');
const axios = require('axios');

// Obtener huéspedes activos (Check-in)
const obtenerHuespedesActivosEmergencia = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        h.id_huesped,
        h.nombre,
        COALESCE(dh.num_documento, 'S/D') AS num_documento,
        r.codigo_habitacion,
        h.telefono,
        h.correo,
        r.estado AS estado_reserva
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      LEFT JOIN documento_huesped dh ON h.id_huesped = dh.id_huesped
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

// Activar emergencia y validar contraseña de administrador
const activarEmergencia = async (peticion, respuesta) => {
  const { id_usuario, contrasenna_admin, mensaje_emitido } = peticion.body;

  if (!id_usuario || !contrasenna_admin || !mensaje_emitido) {
    return respuesta.status(400).json({ mensaje: 'Faltan datos obligatorios para activar la emergencia.' });
  }

  try {
    const consultaUsuario = `
      SELECT u.id_usuario, u.contrasenna, r.nombre AS nombre_rol
      FROM usuario u
      JOIN rol r ON u.id_rol = r.id_rol
      WHERE u.id_usuario = $1 AND u.estado = 'ACTIVO';
    `;
    const resultadoUsuario = await conexion.query(consultaUsuario, [id_usuario]);

    if (resultadoUsuario.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Usuario no encontrado o inactivo.' });
    }

    const usuario = resultadoUsuario.rows[0];
    const contrasennaValida = await bcrypt.compare(contrasenna_admin, usuario.contrasenna);
    
    if (!contrasennaValida) {
      return respuesta.status(401).json({ mensaje: 'Contraseña de administrador incorrecta.' });
    }

    const consultaLog = `
      INSERT INTO emergencia_log (id_usuario, estado, mensaje_emitido)
      VALUES ($1, 'ALERTA', $2)
      RETURNING *;
    `;
    const resultadoLog = await conexion.query(consultaLog, [id_usuario, mensaje_emitido.trim()]);

    return respuesta.status(201).json({
      mensaje: '¡Estado de emergencia activado y registrado exitosamente!',
      emergencia: resultadoLog.rows[0]
    });
  } catch (error) {
    console.error('Error al activar emergencia:', error);
    return respuesta.status(500).json({ mensaje: 'Error interno en el servidor.' });
  }
};

// ENVÍO DE REPORTE DE EMERGENCIA AL TELEGRAM DEL ADMINISTRADOR (SIN EMOJIS)
const enviarMensajeMasivoAlerta = async (peticion, respuesta) => {
  const { mensaje } = peticion.body;

  if (!mensaje || !mensaje.trim()) {
    return respuesta.status(400).json({ mensaje: 'El mensaje de alerta no puede estar vacío.' });
  }

  try {
    const tokenBot = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // Obtener desglose de huéspedes activos para incluir en el reporte ejecutivo
    const consultaSQL = `
      SELECT 
        h.nombre,
        r.codigo_habitacion,
        COALESCE(h.telefono, 'Sin Teléfono') AS telefono
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      WHERE r.estado = 'CHECKIN'
      ORDER BY r.codigo_habitacion ASC;
    `;
    const resultado = await conexion.query(consultaSQL);
    const huespedes = resultado.rows;

    let listaHuespedesTexto = '';
    if (huespedes.length > 0) {
      listaHuespedesTexto = huespedes
        .map((h, index) => `  *${index + 1}.* Hab. *${h.codigo_habitacion}* - ${h.nombre} (${h.telefono})`)
        .join('\n');
    } else {
      listaHuespedesTexto = '  _No hay huéspedes registrados en CHECKIN actualmente._';
    }

    const fechaHora = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });

    // Estructura formal y profesional del reporte sin emojis
    const textoTelegram = 
      `*[ REPORTE OPERATIVO DE EMERGENCIA ]*\n` +
      `----------------------------------------\n` +
      `*Fecha y Hora:* ${fechaHora}\n` +
      `*Estado:* ALERTA DE SEGURIDAD ACTIVADA\n\n` +
      `*Instruccion / Mensaje de Protocolo:*\n` +
      `_"${mensaje.trim()}"_\n\n` +
      `*Censo Inmediato de Evacuacion:*\n` +
      `- *Total Huespedes en Hotel (CHECKIN):* ${huespedes.length}\n\n` +
      `*Desglose por Habitacion:*\n` +
      `${listaHuespedesTexto}\n` +
      `----------------------------------------\n` +
      `_Notificacion generada automaticamente por el Sistema de Control del Hotel._`;

    const urlApiTelegram = `https://api.telegram.org/bot${tokenBot}/sendMessage`;

    await axios.post(urlApiTelegram, {
      chat_id: chatId,
      text: textoTelegram,
      parse_mode: 'Markdown'
    });

    return respuesta.status(200).json({
      mensaje: `Reporte oficial de emergencia transmitido con éxito al Telegram del Administrador (${huespedes.length} huéspedes censados).`
    });
  } catch (error) {
    console.error('Error al enviar reporte por Telegram:', error.response?.data || error.message);
    return respuesta.status(500).json({ mensaje: 'Error al conectar con la API de Telegram.' });
  }
};

module.exports = {
  obtenerHuespedesActivosEmergencia,
  activarEmergencia,
  enviarMensajeMasivoAlerta
};