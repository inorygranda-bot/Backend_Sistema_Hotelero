const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');

// 1. Obtener todas las tarifas con la habitación vinculada
const obtenerTarifas = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        t.id_tarifa,
        t.nombre_tarifa,
        t.ocupacion_base,
        TO_CHAR(t.vigente_desde, 'YYYY-MM-DD') AS vigente_desde,
        TO_CHAR(t.vigente_hasta, 'YYYY-MM-DD') AS vigente_hasta,
        t.incluye,
        COALESCE(t.precio_base, 0) AS precio_base,
        COALESCE(t.estado, 'Activa') AS estado,
        COALESCE(t.iva, 16) AS iva,
        COALESCE(t.huesped_adicional, 0) AS huesped_adicional,
        thab.id_tipo_habitacion,
        COALESCE(thab.nombre_tipo, 'Sin asignar') AS nombre_habitacion
      FROM tarifa t
      LEFT JOIN tarifa_hab th ON t.id_tarifa = th.id_tarifa
      LEFT JOIN tipo_habitacion thab ON th.id_tipo_hab = thab.id_tipo_habitacion
      ORDER BY t.id_tarifa ASC;
    `;

    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener tarifas:', error);
    return respuesta.status(500).json({ 
      mensaje: 'Error al consultar la lista de tarifas en la base de datos.' 
    });
  }
};

// 2. Obtener una tarifa por su ID
const obtenerTarifaPorId = async (peticion, respuesta) => {
  const { id } = peticion.params;

  try {
    const consultaSQL = `
      SELECT 
        t.id_tarifa,
        t.nombre_tarifa,
        t.ocupacion_base,
        TO_CHAR(t.vigente_desde, 'YYYY-MM-DD') AS vigente_desde,
        TO_CHAR(t.vigente_hasta, 'YYYY-MM-DD') AS vigente_hasta,
        t.incluye,
        COALESCE(t.precio_base, 0) AS precio_base,
        COALESCE(t.estado, 'Activa') AS estado,
        COALESCE(t.iva, 16) AS iva,
        COALESCE(t.huesped_adicional, 0) AS huesped_adicional,
        thab.id_tipo_habitacion,
        COALESCE(thab.nombre_tipo, 'Sin asignar') AS nombre_habitacion
      FROM tarifa t
      LEFT JOIN tarifa_hab th ON t.id_tarifa = th.id_tarifa
      LEFT JOIN tipo_habitacion thab ON th.id_tipo_hab = thab.id_tipo_habitacion
      WHERE t.id_tarifa = $1;
    `;

    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Tarifa no encontrada.' });
    }

    return respuesta.status(200).json(resultado.rows[0]);
  } catch (error) {
    console.error(`Error al obtener tarifa ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al obtener los datos de la tarifa.' });
  }
};

// 3. Obtener catálogo de tipos de habitación (para selects del frontend)
const obtenerTiposHabitacion = async (peticion, respuesta) => {
  try {
    const resultado = await conexion.query(
      'SELECT id_tipo_habitacion, nombre_tipo, descripcion FROM tipo_habitacion ORDER BY id_tipo_habitacion ASC;'
    );
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener tipos de habitación:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar tipos de habitación.' });
  }
};

// 4. Crear una nueva tarifa
const crearTarifa = async (peticion, respuesta) => {
  const { 
    nombre_tarifa, 
    id_tipo_habitacion, 
    vigente_desde, 
    vigente_hasta, 
    precio_base, 
    iva, 
    ocupacion_base, 
    huesped_adicional, 
    incluye, 
    estado 
  } = peticion.body;

  if (!nombre_tarifa || !vigente_desde || !vigente_hasta) {
    return respuesta.status(400).json({
      mensaje: 'El nombre de la tarifa y las fechas de vigencia son obligatorios.'
    });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    // 1. Insertar en tabla tarifa
    const consultaTarifa = `
      INSERT INTO tarifa (
        nombre_tarifa, 
        ocupacion_base, 
        vigente_desde, 
        vigente_hasta, 
        incluye, 
        precio_base, 
        estado, 
        iva, 
        huesped_adicional
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id_tarifa;
    `;

    const resultadoTarifa = await cliente.query(consultaTarifa, [
      nombre_tarifa.trim(),
      parseInt(ocupacion_base) || 2,
      vigente_desde,
      vigente_hasta,
      incluye ? incluye.trim() : '',
      parseFloat(precio_base) || 0.00,
      estado || 'Activa',
      parseFloat(iva) || 16.00,
      parseFloat(huesped_adicional) || 0.00
    ]);

    const idNuevaTarifa = resultadoTarifa.rows[0].id_tarifa;

    // 2. Vincular con tipo de habitación en tarifa_hab
    let nombreHabitacion = 'Habitación General';
    if (id_tipo_habitacion) {
      await cliente.query(`
        INSERT INTO tarifa_hab (id_tarifa, id_tipo_hab)
        VALUES ($1, $2)
        ON CONFLICT (id_tarifa, id_tipo_hab) DO NOTHING;
      `, [idNuevaTarifa, parseInt(id_tipo_habitacion)]);

      const tipoHabRes = await cliente.query('SELECT nombre_tipo FROM tipo_habitacion WHERE id_tipo_habitacion = $1', [parseInt(id_tipo_habitacion)]);
      if (tipoHabRes.rows.length > 0) {
        nombreHabitacion = tipoHabRes.rows[0].nombre_tipo;
      }
    }

    await cliente.query('COMMIT');

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(
      idUsuarioResponsable, 
      'Tarifas', 
      `Creó la tarifa comercial "${nombre_tarifa.trim()}" asignada a ${nombreHabitacion} con precio base de $${parseFloat(precio_base || 0).toFixed(2)}`
    );

    return respuesta.status(201).json({
      mensaje: 'Tarifa registrada exitosamente.',
      id_tarifa: idNuevaTarifa
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al registrar tarifa:', error);
    return respuesta.status(500).json({
      mensaje: 'Error interno al intentar guardar la tarifa: ' + error.message
    });
  } finally {
    cliente.release();
  }
};

// 5. Actualizar tarifa existente
const actualizarTarifa = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { 
    nombre_tarifa, 
    id_tipo_habitacion, 
    vigente_desde, 
    vigente_hasta, 
    precio_base, 
    iva, 
    ocupacion_base, 
    huesped_adicional, 
    incluye, 
    estado 
  } = peticion.body;

  if (!nombre_tarifa || !vigente_desde || !vigente_hasta) {
    return respuesta.status(400).json({
      mensaje: 'El nombre de la tarifa y las fechas de vigencia son obligatorios.'
    });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    // 1. Obtener datos anteriores para tracking detallado de cambios
    const tarifaAnteriorRes = await cliente.query(`
      SELECT t.*, thab.nombre_tipo AS nombre_habitacion 
      FROM tarifa t
      LEFT JOIN tarifa_hab th ON t.id_tarifa = th.id_tarifa
      LEFT JOIN tipo_habitacion thab ON th.id_tipo_hab = thab.id_tipo_habitacion
      WHERE t.id_tarifa = $1;
    `, [id]);

    if (tarifaAnteriorRes.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'La tarifa a actualizar no existe.' });
    }

    const tarifaAnterior = tarifaAnteriorRes.rows[0];

    let nuevaHabitacionNombre = 'Habitación General';
    if (id_tipo_habitacion) {
      const tipoHabRes = await cliente.query('SELECT nombre_tipo FROM tipo_habitacion WHERE id_tipo_habitacion = $1', [parseInt(id_tipo_habitacion)]);
      if (tipoHabRes.rows.length > 0) {
        nuevaHabitacionNombre = tipoHabRes.rows[0].nombre_tipo;
      }
    }

    // 2. Actualizar tabla tarifa
    const consultaUpdate = `
      UPDATE tarifa
      SET 
        nombre_tarifa = $1,
        ocupacion_base = $2,
        vigente_desde = $3,
        vigente_hasta = $4,
        incluye = $5,
        precio_base = $6,
        estado = $7,
        iva = $8,
        huesped_adicional = $9
      WHERE id_tarifa = $10;
    `;

    await cliente.query(consultaUpdate, [
      nombre_tarifa.trim(),
      parseInt(ocupacion_base) || 2,
      vigente_desde,
      vigente_hasta,
      incluye ? incluye.trim() : '',
      parseFloat(precio_base) || 0.00,
      estado || 'Activa',
      parseFloat(iva) || 16.00,
      parseFloat(huesped_adicional) || 0.00,
      id
    ]);

    // 3. Actualizar relación en tarifa_hab
    await cliente.query('DELETE FROM tarifa_hab WHERE id_tarifa = $1', [id]);
    if (id_tipo_habitacion) {
      await cliente.query(`
        INSERT INTO tarifa_hab (id_tarifa, id_tipo_hab)
        VALUES ($1, $2);
      `, [id, parseInt(id_tipo_habitacion)]);
    }

    await cliente.query('COMMIT');

    // Detectar cambios exactamente sin mostrar IDs
    let cambios = [];
    if (tarifaAnterior.nombre_tarifa !== nombre_tarifa.trim()) {
      cambios.push(`nombre de "${tarifaAnterior.nombre_tarifa}" a "${nombre_tarifa.trim()}"`);
    }
    if (String(tarifaAnterior.nombre_habitacion || 'Sin asignar') !== String(nuevaHabitacionNombre)) {
      cambios.push(`habitación asignada de "${tarifaAnterior.nombre_habitacion || 'Sin asignar'}" a "${nuevaHabitacionNombre}"`);
    }
    if (parseFloat(tarifaAnterior.precio_base) !== parseFloat(precio_base || 0)) {
      cambios.push(`precio base de $${parseFloat(tarifaAnterior.precio_base).toFixed(2)} a $${parseFloat(precio_base || 0).toFixed(2)}`);
    }
    if (String(tarifaAnterior.estado) !== String(estado || 'Activa')) {
      cambios.push(`estado de "${tarifaAnterior.estado}" a "${estado || 'Activa'}"`);
    }
    if (parseInt(tarifaAnterior.ocupacion_base) !== parseInt(ocupacion_base || 2)) {
      cambios.push(`ocupación base de ${tarifaAnterior.ocupacion_base} a ${ocupacion_base || 2}`);
    }
    if (parseFloat(tarifaAnterior.huesped_adicional) !== parseFloat(huesped_adicional || 0)) {
      cambios.push(`huésped adicional de $${parseFloat(tarifaAnterior.huesped_adicional).toFixed(2)} a $${parseFloat(huesped_adicional || 0).toFixed(2)}`);
    }

    const detalleModificacion = cambios.length > 0 ? cambios.join(', ') : 'actualizó los datos sin cambios notables';
    const descripcionAuditoria = `Actualizó la tarifa comercial "${tarifaAnterior.nombre_tarifa}": modificó ${detalleModificacion}.`;

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(idUsuarioResponsable, 'Tarifas', descripcionAuditoria);

    return respuesta.status(200).json({
      mensaje: 'Tarifa actualizada correctamente.'
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al actualizar tarifa ID ${id}:`, error);
    return respuesta.status(500).json({
      mensaje: 'Error interno al actualizar la tarifa: ' + error.message
    });
  } finally {
    cliente.release();
  }
};

// 6. Eliminar tarifa
const eliminarTarifa = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    // Obtener información comercial antes de eliminar para el log
    const tarifaInfoRes = await cliente.query(`
      SELECT t.nombre_tarifa, thab.nombre_tipo AS nombre_habitacion
      FROM tarifa t
      LEFT JOIN tarifa_hab th ON t.id_tarifa = th.id_tarifa
      LEFT JOIN tipo_habitacion thab ON th.id_tipo_hab = thab.id_tipo_habitacion
      WHERE t.id_tarifa = $1;
    `, [id]);

    const tarifaInfo = tarifaInfoRes.rows[0];
    const nombreTarifaEliminada = tarifaInfo ? tarifaInfo.nombre_tarifa : 'una tarifa';
    const habitacionAsociada = tarifaInfo?.nombre_habitacion ? ` de la habitación ${tarifaInfo.nombre_habitacion}` : '';

    // 1. Eliminar referencias en tarifa_hab
    await cliente.query('DELETE FROM tarifa_hab WHERE id_tarifa = $1', [id]);

    // 2. Eliminar de la tabla tarifa
    const resultado = await cliente.query('DELETE FROM tarifa WHERE id_tarifa = $1 RETURNING id_tarifa', [id]);

    if (resultado.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'La tarifa a eliminar no existe.' });
    }

    await cliente.query('COMMIT');

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(idUsuarioResponsable, 'Tarifas', `Eliminó permanentemente la tarifa comercial "${nombreTarifaEliminada}"${habitacionAsociada}`);

    return respuesta.status(200).json({
      mensaje: 'Tarifa eliminada permanentemente del sistema.'
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al eliminar tarifa ID ${id}:`, error);
    return respuesta.status(500).json({
      mensaje: 'No se pudo eliminar la tarifa.'
    });
  } finally {
    cliente.release();
  }
};

// 7. Duplicar tarifa
const duplicarTarifa = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    // 1. Obtener la original
    const origRes = await cliente.query('SELECT * FROM tarifa WHERE id_tarifa = $1', [id]);
    if (origRes.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'Tarifa original no encontrada.' });
    }

    const orig = origRes.rows[0];
    const nuevoNombre = `${orig.nombre_tarifa} (Copia)`;

    // 2. Insertar copia
    const insRes = await cliente.query(`
      INSERT INTO tarifa (
        nombre_tarifa, 
        ocupacion_base, 
        vigente_desde, 
        vigente_hasta, 
        incluye, 
        precio_base, 
        estado, 
        iva, 
        huesped_adicional
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'Borrador', $7, $8)
      RETURNING id_tarifa;
    `, [
      nuevoNombre,
      orig.ocupacion_base,
      orig.vigente_desde,
      orig.vigente_hasta,
      orig.incluye,
      orig.precio_base,
      orig.iva,
      orig.huesped_adicional
    ]);

    const nuevaId = insRes.rows[0].id_tarifa;

    // 3. Copiar relación con tipo de habitación
    const habRes = await cliente.query('SELECT id_tipo_hab FROM tarifa_hab WHERE id_tarifa = $1', [id]);
    if (habRes.rows.length > 0) {
      await cliente.query(`
        INSERT INTO tarifa_hab (id_tarifa, id_tipo_hab)
        VALUES ($1, $2)
      `, [nuevaId, habRes.rows[0].id_tipo_hab]);
    }

    await cliente.query('COMMIT');

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(idUsuarioResponsable, 'Tarifas', `Duplicó la tarifa comercial "${orig.nombre_tarifa}" generando la nueva tarifa "${nuevoNombre}" en estado Borrador`);

    return respuesta.status(201).json({
      mensaje: 'Tarifa duplicada correctamente en estado Borrador.',
      id_tarifa: nuevaId
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al duplicar tarifa ID ${id}:`, error);
    return respuesta.status(500).json({
      mensaje: 'Error interno al duplicar la tarifa: ' + error.message
    });
  } finally {
    cliente.release();
  }
};

// 8. Consultar Tasa Oficial BCV del día en vivo mediante API pública
let cacheTasaBCV = {
  tasa: 872.39,
  fecha: new Date().toISOString(),
  fuente: 'Oficial BCV',
  ultimaConsulta: 0
};

const obtenerTasaBCV = async (peticion, respuesta) => {
  const ahora = Date.now();
  if (ahora - cacheTasaBCV.ultimaConsulta < 10 * 60 * 1000 && cacheTasaBCV.ultimaConsulta > 0) {
    return respuesta.status(200).json(cacheTasaBCV);
  }

  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    if (res.ok) {
      const data = await res.json();
      cacheTasaBCV = {
        tasa: parseFloat(data.promedio) || cacheTasaBCV.tasa,
        fecha: data.fechaActualizacion || new Date().toISOString(),
        fuente: 'BCV Oficial (DolarAPI)',
        ultimaConsulta: ahora
      };
      return respuesta.status(200).json(cacheTasaBCV);
    }
  } catch (error) {
    console.warn('Aviso: no se pudo consultar API externa BCV, usando cache:', error.message);
  }

  return respuesta.status(200).json(cacheTasaBCV);
};

module.exports = {
  obtenerTarifas,
  obtenerTarifaPorId,
  obtenerTiposHabitacion,
  crearTarifa,
  actualizarTarifa,
  eliminarTarifa,
  duplicarTarifa,
  obtenerTasaBCV
};