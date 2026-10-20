const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const API_BACKEND = 'http://localhost:3000/api';

const sesionesUsuarios = {};

bot.start((ctx) => {
  ctx.reply(
    `¡Bienvenido al sistema de reservas del Hotel!\n\n` +
    `Comandos disponibles:\n` +
    `/disponibles - Consultar habitaciones libres.\n` +
    `/reservar - Iniciar una nueva reserva.\n` +
    `/cancelar - Cancelar el proceso actual.\n` +
    `/ayuda - Ver asistencia.`
  );
});

bot.help((ctx) => {
  ctx.reply('Usa /disponibles para consultar habitaciones y /reservar para iniciar el proceso. Si deseas salir de un registro a medias, usa /cancelar.');
});

bot.command('cancelar', (ctx) => {
  const userId = ctx.from.id;
  if (sesionesUsuarios[userId]) {
    delete sesionesUsuarios[userId];
    ctx.reply('Has cancelado el proceso actual de reserva.');
  } else {
    ctx.reply('No tienes ningún proceso activo en este momento.');
  }
});

bot.command('disponibles', async (ctx) => {
  const texto = ctx.message.text.split(' ');
  if (texto.length < 3) {
    return ctx.reply('Indica el rango de fechas. Ejemplo:\n`/disponibles 2026-11-01 2026-11-05`', { parse_mode: 'Markdown' });
  }

  const checkin = texto[1];
  const checkout = texto[2];


  const hoyStr = new Date().toISOString().split('T')[0];
  if (checkin < hoyStr) {
    return ctx.reply('La fecha de entrada no puede ser una fecha pasada.');
  }

  if (new Date(checkout) <= new Date(checkin)) {
    return ctx.reply('La fecha de salida debe ser posterior a la de entrada.');
  }

  try {
    const [respHab, respRes, respTemporadas, respTarifas] = await Promise.all([
      axios.get(`${API_BACKEND}/habitaciones`),
      axios.get(`${API_BACKEND}/reservas`),
      axios.get(`${API_BACKEND}/tarifas/temporadas`),
      axios.get(`${API_BACKEND}/tarifas`)
    ]);

    const habitaciones = respHab.data;
    const reservas = respRes.data;
    const temporadas = respTemporadas.data;
    const tarifas = respTarifas.data;

    const [yearCheckin, monthCheckin, dayCheckin] = checkin.split('-').map(Number);
    const fechaCheckinReal = new Date(Date.UTC(yearCheckin, monthCheckin - 1, dayCheckin));

    const libres = habitaciones.filter(hab => {
      if (hab.estado === 'Fuera de servicio') return false;
      const solapada = reservas.some(res => {
        if (Number(res.codigo_habitacion) !== Number(hab.codigo_habitacion)) return false;
        if (['CANCELADA', 'CHECKOUT'].includes(res.estado)) return false;
        return checkin < res.fecha_checkout.slice(0, 10) && checkout > res.fecha_checkin.slice(0, 10);
      });
      return !solapada;
    });

    if (libres.length === 0) {
      return ctx.reply('Lo sentimos, no hay habitaciones disponibles para el rango de fechas seleccionado.');
    }

    let mensaje = `*Habitaciones Libres del ${checkin} al ${checkout}*:\n\n`;

    libres.forEach(hab => {

      const temporadaEncontrada = temporadas.find((temp) => {
        if (!temp.fecha_inicio || !temp.fecha_fin || temp.fecha_inicio === 'N/A' || temp.fecha_fin === 'N/A') return false;
        const [mIni, dIni] = temp.fecha_inicio.split('-').map(Number);
        const [mFin, dFin] = temp.fecha_fin.split('-').map(Number);
        if (!mIni || !dIni || !mFin || !dFin) return false;

        let fechaInicioTemp = new Date(Date.UTC(yearCheckin, mIni - 1, dIni));
        let fechaFinTemp = new Date(Date.UTC(yearCheckin, mFin - 1, dFin));
        if (mIni > mFin) {
          if (monthCheckin >= mIni) fechaFinTemp = new Date(Date.UTC(yearCheckin + 1, mFin - 1, dFin));
          else fechaInicioTemp = new Date(Date.UTC(yearCheckin - 1, mIni - 1, dIni));
        }
        return fechaCheckinReal >= fechaInicioTemp && fechaCheckinReal <= fechaFinTemp;
      });

      let idTemporadaObjetivo = null;
      if (temporadaEncontrada) {
        idTemporadaObjetivo = temporadaEncontrada.id_temporada;
      } else {
        const temporadaNormal = temporadas.find((t) =>
          t.fecha_inicio === 'N/A' ||
          t.nombre_temporada.toLowerCase().includes('temporada normal') ||
          t.nombre_temporada.toLowerCase().includes('baja')
        );
        if (temporadaNormal) idTemporadaObjetivo = temporadaNormal.id_temporada;
      }

      const tarifaCoincidente = tarifas.find((t) => {
        const matchTipo = String(t.id_tipo_habitacion) === String(hab.id_tipo_habitacion);
        const matchEstado = t.estado?.toLowerCase() === 'activa';
        const matchTemp = idTemporadaObjetivo ? (Array.isArray(t.id_temporadas)
          ? t.id_temporadas.some(idT => String(idT) === String(idTemporadaObjetivo))
          : String(t.id_temporada) === String(idTemporadaObjetivo)) : true;
        return matchTipo && matchEstado && matchTemp;
      });

      const precioNoche = tarifaCoincidente?.precio_base || hab.precio_base || 120;

      mensaje += `• *Habitación N° ${hab.codigo_habitacion}* (${hab.nombre_tipo})\n` +
        `  Piso: ${hab.piso} | Capacidad máx: *${hab.capacidad} personas*\n` +
        `  Precio por noche: *$ ${precioNoche} USD*\n` +
        `  Amenidades: ${hab.amenidades}\n\n`;
    });

    mensaje += `Para proceder a reservar escribe /reservar`;
    ctx.reply(mensaje, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error.message);
    ctx.reply('Hubo un error al consultar la disponibilidad en el servidor.');
  }
});

bot.command('reservar', (ctx) => {
  const userId = ctx.from.id;
  sesionesUsuarios[userId] = { paso: 'ESPERANDO_DOCUMENTO_CONSULTA', recargos_seleccionados: [] };
  ctx.reply('Por favor, ingresa tu *Número de Documento* (Cédula o Pasaporte) para verificar tu registro:\n*(O escribe /cancelar para salir)*', { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const sesion = sesionesUsuarios[userId];

  if (!sesion) return;

  const texto = ctx.message.text.trim();

  if (texto.startsWith('/')) {
    return ctx.reply('Estás en medio de un registro. Por favor completa los datos solicitados o escribe /cancelar para salir.');
  }

  switch (sesion.paso) {
    case 'ESPERANDO_DOCUMENTO_CONSULTA':
      sesion.num_documento = texto;

      try {
        const respHuespedes = await axios.get(`${API_BACKEND}/huespedes`);
        const existeHuesped = respHuespedes.data.find(h => h.num_documento.toLowerCase() === texto.toLowerCase());

        if (existeHuesped) {
          sesion.id_huesped = existeHuesped.id_huesped;
          sesion.nombre = existeHuesped.nombre;
          sesion.paso = 'ESPERANDO_CHECKIN';
          ctx.reply(`¡Hola de nuevo, *${existeHuesped.nombre}*! \n\nIngresa la fecha de *entrada* (Formato: AAAA-MM-DD):`, { parse_mode: 'Markdown' });
        } else {
          sesion.paso = 'ESPERANDO_TIPO_DOCUMENTO';
          ctx.reply(
            `No encontramos tu registro previo.\n\n` +
            `Selecciona tu *Tipo de Documento* escribiendo la opción o la letra correspondiente:\n` +
            `• *V* (Venezolano)\n` +
            `• *E* (Extranjero)\n` +
            `• *P* (Pasaporte)\n` +
            `• *J* (Jurídico)`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (err) {
        console.error('Error al consultar huésped:', err.message);
        ctx.reply('Error interno al consultar el registro de huésped.');
        delete sesionesUsuarios[userId];
      }
      break;

    case 'ESPERANDO_TIPO_DOCUMENTO':

      const inputDoc = texto.toUpperCase();
      let letraDoc = 'V';
      if (inputDoc.includes('E')) letraDoc = 'E';
      else if (inputDoc.includes('P')) letraDoc = 'P';
      else if (inputDoc.includes('J')) letraDoc = 'J';
      else if (inputDoc.includes('V')) letraDoc = 'V';
      else if (['V', 'E', 'P', 'J'].includes(inputDoc[0])) letraDoc = inputDoc[0];

      sesion.tipo_documento = letraDoc;
      sesion.paso = 'ESPERANDO_NOMBRE';
      ctx.reply(`Has seleccionado tipo: *${letraDoc}*.\n\nAhora escribe tu *Nombre y Apellido* completo:`, { parse_mode: 'Markdown' });
      break;

    case 'ESPERANDO_NOMBRE':
      sesion.nombre = texto;
      sesion.paso = 'ESPERANDO_TELEFONO';
      ctx.reply('Indica tu número de *Teléfono* de contacto:', { parse_mode: 'Markdown' });
      break;

    case 'ESPERANDO_TELEFONO':
      sesion.telefono = texto;
      sesion.paso = 'ESPERANDO_CORREO';
      ctx.reply('Escribe tu *Correo Electrónico*:', { parse_mode: 'Markdown' });
      break;

    case 'ESPERANDO_CORREO':
      sesion.correo = texto;

      try {
        const nuevoHuespedResp = await axios.post(`${API_BACKEND}/huespedes`, {
          tipo_documento: sesion.tipo_documento,
          num_documento: sesion.num_documento,
          nombre: sesion.nombre,
          telefono: sesion.telefono,
          correo: sesion.correo,
          estado: 'ACTIVO'
        });

        sesion.id_huesped = nuevoHuespedResp.data.id_huesped;
        sesion.paso = 'ESPERANDO_CHECKIN';

        ctx.reply('*Huésped registrado exitosamente.*\n\nAhora, ingresa la fecha de *entrada* (Formato: AAAA-MM-DD):', { parse_mode: 'Markdown' });
      } catch (err) {
        console.error('Error al registrar nuevo huésped:', err.response?.data || err.message);
        ctx.reply('Ocurrió un error al guardar tus datos. Verifica que el correo o documento no estén duplicados. Escribe /reservar para intentar de nuevo.');
        delete sesionesUsuarios[userId];
      }
      break;

    case 'ESPERANDO_CHECKIN':
      const hoyStrBot = new Date().toISOString().split('T')[0];

      if (texto < hoyStrBot) {
        return ctx.reply('La fecha de entrada no puede ser una fecha pasada. Por favor, ingresa una fecha válida (Formato: AAAA-MM-DD):');
      }

      sesion.fecha_checkin = texto;
      sesion.paso = 'ESPERANDO_CHECKOUT';
      ctx.reply('Ingresa la fecha de *salida* (Formato: AAAA-MM-DD):', { parse_mode: 'Markdown' });
      break;

    case 'ESPERANDO_CHECKOUT':
      sesion.fecha_checkout = texto;
      if (new Date(sesion.fecha_checkout) <= new Date(sesion.fecha_checkin)) {
        return ctx.reply('La fecha de salida debe ser posterior a la de entrada. Ingresa la salida de nuevo (AAAA-MM-DD):');
      }
      sesion.paso = 'ESPERANDO_HUESPEDES';
      ctx.reply('¿Cuántas personas se hospedarán en total?', { parse_mode: 'Markdown' });
      break;

    case 'ESPERANDO_HUESPEDES':
      const cantHuespedes = parseInt(texto);
      if (isNaN(cantHuespedes) || cantHuespedes <= 0) {
        return ctx.reply('Por favor ingresa un número válido de huéspedes:');
      }
      sesion.cantidad_huespedes = cantHuespedes;
      sesion.paso = 'ESPERANDO_HABITACION';

      try {
        const [respHab, respRes, respTemporadas, respTarifas] = await Promise.all([
          axios.get(`${API_BACKEND}/habitaciones`),
          axios.get(`${API_BACKEND}/reservas`),
          axios.get(`${API_BACKEND}/tarifas/temporadas`),
          axios.get(`${API_BACKEND}/tarifas`)
        ]);

        const habitaciones = respHab.data;
        const reservas = respRes.data;
        const temporadas = respTemporadas.data;
        const tarifas = respTarifas.data;

        const [yearCheckin, monthCheckin, dayCheckin] = sesion.fecha_checkin.split('-').map(Number);
        const fechaCheckinReal = new Date(Date.UTC(yearCheckin, monthCheckin - 1, dayCheckin));

        const libres = habitaciones.filter(hab => {
          if (hab.estado === 'Fuera de servicio') return false;
          const solapada = reservas.some(res => {
            if (Number(res.codigo_habitacion) !== Number(hab.codigo_habitacion)) return false;
            if (['CANCELADA', 'CHECKOUT'].includes(res.estado)) return false;
            return sesion.fecha_checkin < res.fecha_checkout.slice(0, 10) && sesion.fecha_checkout > res.fecha_checkin.slice(0, 10);
          });
          return !solapada;
        });

        if (libres.length === 0) {
          ctx.reply('No hay habitaciones disponibles en ese rango de fechas. Reserva cancelada.');
          delete sesionesUsuarios[userId];
          return;
        }

        sesion.habitaciones_disponibles = libres;

        let msg = '*Habitaciones Disponibles para tus fechas*:\n\n';
        libres.forEach(h => {
          const temporadaEncontrada = temporadas.find((temp) => {
            if (!temp.fecha_inicio || !temp.fecha_fin || temp.fecha_inicio === 'N/A' || temp.fecha_fin === 'N/A') return false;
            const [mIni, dIni] = temp.fecha_inicio.split('-').map(Number);
            const [mFin, dFin] = temp.fecha_fin.split('-').map(Number);
            if (!mIni || !dIni || !mFin || !dFin) return false;

            let fechaInicioTemp = new Date(Date.UTC(yearCheckin, mIni - 1, dIni));
            let fechaFinTemp = new Date(Date.UTC(yearCheckin, mFin - 1, dFin));
            if (mIni > mFin) {
              if (monthCheckin >= mIni) fechaFinTemp = new Date(Date.UTC(yearCheckin + 1, mFin - 1, dFin));
              else fechaInicioTemp = new Date(Date.UTC(yearCheckin - 1, mIni - 1, dIni));
            }
            return fechaCheckinReal >= fechaInicioTemp && fechaCheckinReal <= fechaFinTemp;
          });

          let idTemporadaObjetivo = null;
          if (temporadaEncontrada) {
            idTemporadaObjetivo = temporadaEncontrada.id_temporada;
          } else {
            const temporadaNormal = temporadas.find((t) =>
              t.fecha_inicio === 'N/A' ||
              t.nombre_temporada.toLowerCase().includes('temporada normal') ||
              t.nombre_temporada.toLowerCase().includes('baja')
            );
            if (temporadaNormal) idTemporadaObjetivo = temporadaNormal.id_temporada;
          }

          const tarifaCoincidente = tarifas.find((t) => {
            const matchTipo = String(t.id_tipo_habitacion) === String(h.id_tipo_habitacion);
            const matchEstado = t.estado?.toLowerCase() === 'activa';
            const matchTemp = idTemporadaObjetivo ? (Array.isArray(t.id_temporadas)
              ? t.id_temporadas.some(idT => String(idT) === String(idTemporadaObjetivo))
              : String(t.id_temporada) === String(idTemporadaObjetivo)) : true;
            return matchTipo && matchEstado && matchTemp;
          });

          const precioNoche = tarifaCoincidente?.precio_base || h.precio_base || 120;
          h.precio_calculado = precioNoche;

          msg += `• Habitación *${h.codigo_habitacion}* - ${h.nombre_tipo} (Capacidad: ${h.capacidad} pers. | *$${precioNoche}/noche*)\n`;
        });
        msg += '\nEscribe únicamente el *número de la habitación* que deseas:';
        ctx.reply(msg, { parse_mode: 'Markdown' });
      } catch (err) {
        console.error(err);
        ctx.reply('Error al obtener las habitaciones.');
        delete sesionesUsuarios[userId];
      }
      break;

    case 'ESPERANDO_HABITACION':
      const codHab = parseInt(texto);
      const habSeleccionada = sesion.habitaciones_disponibles?.find(h => Number(h.codigo_habitacion) === codHab);

      if (!habSeleccionada) {
        return ctx.reply('El número de habitación no es válido o no está disponible. Intenta de nuevo:');
      }

      if (sesion.cantidad_huespedes > habSeleccionada.capacidad) {
        return ctx.reply(
          `*La cantidad de huéspedes (${sesion.cantidad_huespedes}) supera la capacidad máxima de esta habitación (${habSeleccionada.capacidad} personas).*` +
          `\nPor favor, elige otra habitación de la lista o escribe /reservar para reiniciar:`,
          { parse_mode: 'Markdown' }
        );
      }

      sesion.codigo_habitacion = codHab;
      sesion.precio_base = habSeleccionada.precio_calculado;

      try {
        const respRecargos = await axios.get(`${API_BACKEND}/recargos`);
        sesion.recargos_disponibles = respRecargos.data;

        if (sesion.recargos_disponibles.length > 0) {
          sesion.paso = 'ESPERANDO_RECARGOS';
          let msg = '*¿Aplica alguno de los siguientes recargos o casos especiales para tu estancia?*\n\n';
          sesion.recargos_disponibles.forEach((rec, idx) => {
            const valor = rec.tipo_operacion === 'Porcentaje' ? `${rec.monto}%` : `$${rec.monto}`;
            msg += `${idx + 1}. *${rec.motivo_recargo}* (${rec.tipo_calculo}: ${valor})\n`;
          });
          msg += `\nEscribe el *número del recargo* que te corresponda, o escribe *ninguno* para continuar:`;
          return ctx.reply(msg, { parse_mode: 'Markdown' });
        }
      } catch (e) {
        console.warn('No se pudieron cargar recargos, omitiendo paso:', e.message);
      }

      await finalizarReserva(ctx, sesion, userId);
      break;

    case 'ESPERANDO_RECARGOS':
      if (texto.toLowerCase() !== 'ninguno') {
        const indexRecargo = parseInt(texto) - 1;
        if (!isNaN(indexRecargo) && sesion.recargos_disponibles[indexRecargo]) {
          const recargoElegido = sesion.recargos_disponibles[indexRecargo];
          sesion.recargos_seleccionados.push(recargoElegido.id_recargo);
          ctx.reply(`Recargo "${recargoElegido.motivo_recargo}" agregado.`);
        } else {
          ctx.reply('Opción no válida. Escribe el número del recargo o "ninguno":');
          return;
        }
      }
      await finalizarReserva(ctx, sesion, userId);
      break;
  }
});

async function finalizarReserva(ctx, sesion, userId) {
  try {
    const [respHab, respTemporadas, respTarifas, respRecargos] = await Promise.all([
      axios.get(`${API_BACKEND}/habitaciones`),
      axios.get(`${API_BACKEND}/tarifas/temporadas`),
      axios.get(`${API_BACKEND}/tarifas`),
      axios.get(`${API_BACKEND}/recargos`)
    ]);

    const habitaciones = respHab.data;
    const temporadas = respTemporadas.data;
    const tarifasCatalogo = respTarifas.data;
    const recargosDisponibles = respRecargos.data;

    const habitacionSeleccionada = habitaciones.find(
      (h) => String(h.codigo_habitacion) === String(sesion.codigo_habitacion)
    );

    let precioBaseNoche = parseFloat(habitacionSeleccionada?.precio_base || 120);
    let ocupacionBase = habitacionSeleccionada?.ocupacion_base != null ? parseInt(habitacionSeleccionada.ocupacion_base) : 2;
    let cargoHuespedAdicional = parseFloat(habitacionSeleccionada?.huesped_adicional || 15);
    let ivaPorc = parseFloat(habitacionSeleccionada?.iva || 16);

    if (sesion.fecha_checkin && habitacionSeleccionada) {
      const [yearCheckin, monthCheckin, dayCheckin] = sesion.fecha_checkin.split('-').map(Number);
      const fechaCheckinReal = new Date(Date.UTC(yearCheckin, monthCheckin - 1, dayCheckin));

      const temporadaEncontrada = temporadas.find((temp) => {
        if (!temp.fecha_inicio || !temp.fecha_fin || temp.fecha_inicio === 'N/A' || temp.fecha_fin === 'N/A') return false;
        const [mIni, dIni] = temp.fecha_inicio.split('-').map(Number);
        const [mFin, dFin] = temp.fecha_fin.split('-').map(Number);
        if (!mIni || !dIni || !mFin || !dFin) return false;

        let fechaInicioTemp = new Date(Date.UTC(yearCheckin, mIni - 1, dIni));
        let fechaFinTemp = new Date(Date.UTC(yearCheckin, mFin - 1, dFin));
        if (mIni > mFin) {
          if (monthCheckin >= mIni) fechaFinTemp = new Date(Date.UTC(yearCheckin + 1, mFin - 1, dFin));
          else fechaInicioTemp = new Date(Date.UTC(yearCheckin - 1, mIni - 1, dIni));
        }
        return fechaCheckinReal >= fechaInicioTemp && fechaCheckinReal <= fechaFinTemp;
      });

      let idTemporadaObjetivo = null;
      if (temporadaEncontrada) {
        idTemporadaObjetivo = temporadaEncontrada.id_temporada;
      } else {
        const temporadaNormal = temporadas.find((t) =>
          t.fecha_inicio === 'N/A' ||
          t.nombre_temporada.toLowerCase().includes('temporada normal') ||
          t.nombre_temporada.toLowerCase().includes('baja')
        );
        if (temporadaNormal) idTemporadaObjetivo = temporadaNormal.id_temporada;
      }

      if (idTemporadaObjetivo) {
        const tarifaCoincidente = tarifasCatalogo.find((t) => {
          const matchTipo = String(t.id_tipo_habitacion) === String(habitacionSeleccionada.id_tipo_habitacion);
          const matchEstado = t.estado?.toLowerCase() === 'activa';
          const matchTemp = Array.isArray(t.id_temporadas)
            ? t.id_temporadas.some(idT => String(idT) === String(idTemporadaObjetivo))
            : String(t.id_temporada) === String(idTemporadaObjetivo);
          return matchTipo && matchEstado && matchTemp;
        });

        if (tarifaCoincidente) {
          precioBaseNoche = parseFloat(tarifaCoincidente.precio_base || precioBaseNoche);
          ocupacionBase = parseInt(tarifaCoincidente.ocupacion_base || ocupacionBase);
          cargoHuespedAdicional = parseFloat(tarifaCoincidente.huesped_adicional || cargoHuespedAdicional);
          ivaPorc = parseFloat(tarifaCoincidente.iva || ivaPorc);
        }
      }
    }

    let noches = 1;
    const fIn = new Date(sesion.fecha_checkin + 'T00:00:00');
    const fOut = new Date(sesion.fecha_checkout + 'T00:00:00');
    if (!isNaN(fIn.getTime()) && !isNaN(fOut.getTime())) {
      const diffMs = fOut.getTime() - fIn.getTime();
      const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDias > 0) noches = diffDias;
    }

    const cantidadHuespedes = parseInt(sesion.cantidad_huespedes || 1);
    const huespedesExtra = Math.max(0, cantidadHuespedes - ocupacionBase);
    const costoExtraTotal = huespedesExtra * cargoHuespedAdicional * noches;
    const subtotalTarifaBase = precioBaseNoche * noches;
    const subtotalAlojamiento = subtotalTarifaBase + costoExtraTotal;

    let totalAjustesCalculados = 0;
    if (Array.isArray(sesion.recargos_seleccionados)) {
      sesion.recargos_seleccionados.forEach((idRec) => {
        const recObj = recargosDisponibles.find((r) => String(r.id_recargo) === String(idRec));
        if (recObj) {
          const val = parseFloat(recObj.monto || 0);
          const tipoOp = String(recObj.tipo_operacion || '').toLowerCase();
          const tipoCalc = String(recObj.tipo_calculo || '').toLowerCase();

          let montoItem = tipoOp.includes('porcentaje') ? subtotalAlojamiento * (val / 100) : val;
          if (tipoCalc.includes('resta') || tipoCalc.includes('descuento')) montoItem = -montoItem;
          totalAjustesCalculados += montoItem;
        }
      });
    }

    const subtotalConAjustes = Math.max(0, subtotalAlojamiento + totalAjustesCalculados);
    const ivaUSD = subtotalConAjustes * (ivaPorc / 100);
    const totalUSD = subtotalConAjustes + ivaUSD;

    const payloadReserva = {
      id_huesped: sesion.id_huesped,
      codigo_habitacion: sesion.codigo_habitacion,
      fecha_checkin: sesion.fecha_checkin,
      fecha_checkout: sesion.fecha_checkout,
      cantidad_huespedes: sesion.cantidad_huespedes,
      id_telegram: userId.toString(),
      usuario_telegram: `@${ctx.from.username || ctx.from.first_name}`,
      monto_pagado: totalUSD,
      recargos_ids: sesion.recargos_seleccionados
    };

    await axios.post(`${API_BACKEND}/reservas/telegram`, payloadReserva);

    ctx.reply(
      `*¡Reserva Registrada con Éxito!*\n\n` +
      ` Huésped: ${sesion.nombre}\n` +
      ` Habitación N° ${sesion.codigo_habitacion}\n` +
      ` Del ${sesion.fecha_checkin} al ${sesion.fecha_checkout} (${noches} noches)\n` +
      ` Huéspedes: ${sesion.cantidad_huespedes}\n` +
      ` Monto Total: $${totalUSD.toFixed(2)} USD\n\n` +
      `Estado actual: *PENDIENTE*. Te avisaremos cuando el recepcionista la confirme.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error al registrar reserva desde bot:', error.response?.data || error.message);
    ctx.reply('Ocurrió un error al procesar tu reserva en el sistema.');
  } finally {
    delete sesionesUsuarios[userId];
  }
}

module.exports = bot;