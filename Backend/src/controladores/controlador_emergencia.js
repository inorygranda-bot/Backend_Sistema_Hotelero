const conexion = require('../config/conexion');
const bcrypt = require('bcrypt');
const axios = require('axios');

// Obtener huéspedes activos (Check-in) de forma segura con LEFT JOIN
const obtenerHuespedesActivosEmergencia = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        h.id_huesped,
        h.nombre,
        COALESCE(dh.num_documento, 'S/D') AS num_documento,
        r.codigo_habitacion,
        COALESCE(hab.piso, 'S/P') AS piso,
        h.telefono,
        h.correo,
        r.estado AS estado_reserva
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      LEFT JOIN documento_huesped dh ON h.id_huesped = dh.id_huesped
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

// Consultar el estado actual de la emergencia de forma segura
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
    // Devuelve estado NORMAL por defecto para evitar congelar la interfaz ante cualquier eventualidad
    return respuesta.status(200).json({ estado: 'NORMAL' });
  }
};

// Activar emergencia y validar contraseña de administrador
const activarEmergencia = async (peticion, respuesta) => {
  const { id_usuario, contrasenna_admin } = peticion.body;

  if (!id_usuario || !contrasenna_admin) {
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
      return respuesta.status(500).json({ mensaje: 'No se encontró un administrador activo en el sistema para autorizar la emergencia.' });
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

    return respuesta.status(201).json({
      mensaje: 'Estado de emergencia activado y registrado exitosamente.',
      emergencia: resultadoLog.rows[0]
    });
  } catch (error) {
    console.error('Error al activar emergencia:', error);
    return respuesta.status(500).json({ mensaje: 'Error interno en el servidor.' });
  }
};

// Desactivar emergencia registrando el estado NORMAL en la BD
const desactivarEmergencia = async (peticion, respuesta) => {
  const { id_usuario } = peticion.body;

  if (!id_usuario) {
    return respuesta.status(400).json({ mensaje: 'ID de usuario obligatorio para normalizar el sistema.' });
  }

  try {
    const consultaLog = `
      INSERT INTO emergencia_log (id_usuario, estado, mensaje_emitido)
      VALUES ($1, 'NORMAL', 'Sistema normalizado y protocolos finalizados')
      RETURNING *;
    `;
    const resultadoLog = await conexion.query(consultaLog, [id_usuario]);

    return respuesta.status(200).json({
      mensaje: 'Sistema normalizado exitosamente.',
      emergencia: resultadoLog.rows[0]
    });
  } catch (error) {
    console.error('Error al desactivar emergencia:', error);
    return respuesta.status(500).json({ mensaje: 'Error interno en el servidor.' });
  }
};

// ENVÍO DE REPORTE A TELEGRAM Y ACTUALIZACIÓN DEL MENSAJE EN EL LOG
const enviarMensajeMasivoAlerta = async (peticion, respuesta) => {
  const { mensaje } = peticion.body;

  if (!mensaje || !mensaje.trim()) {
    return respuesta.status(400).json({ mensaje: 'El mensaje de alerta no puede estar vacío.' });
  }

  try {
    const tokenBot = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    const consultaSQL = `
      SELECT 
        h.nombre,
        r.codigo_habitacion,
        COALESCE(hab.piso, 'S/P') AS piso,
        COALESCE(h.telefono, 'Sin Teléfono') AS telefono
      FROM reserva r
      JOIN huesped h ON r.id_huesped = h.id_huesped
      LEFT JOIN documento_huesped dh ON h.id_huesped = dh.id_huesped
      LEFT JOIN habitacion hab ON r.codigo_habitacion = hab.codigo_habitacion
      WHERE r.estado = 'CHECKIN'
      ORDER BY r.codigo_habitacion ASC;
    `;
    const resultado = await conexion.query(consultaSQL);
    const huespedes = resultado.rows;

    let listaHuespedesTexto = '';
    if (huespedes.length > 0) {
      listaHuespedesTexto = huespedes
        .map((h, index) => `  *${index + 1}.* Hab. *${h.codigo_habitacion}* (Piso ${h.piso}) - ${h.nombre} (${h.telefono})`)
        .join('\n');
    } else {
      listaHuespedesTexto = '  _No hay huéspedes registrados en CHECKIN actualmente._';
    }

    const fechaHora = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });

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

    const actualizarLogSQL = `
      UPDATE emergencia_log 
      SET mensaje_emitido = $1 
      WHERE estado = 'ALERTA' 
      AND id_emergencia = (SELECT MAX(id_emergencia) FROM emergencia_log WHERE estado = 'ALERTA');
    `;
    await conexion.query(actualizarLogSQL, [mensaje.trim()]);

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
  obtenerEstadoEmergencia,
  activarEmergencia,
  desactivarEmergencia,
  enviarMensajeMasivoAlerta
};