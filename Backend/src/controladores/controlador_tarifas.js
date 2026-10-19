const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');

// 1. Obtener todas las tarifas con sus temporadas y habitaciones vinculadas
const obtenerTarifas = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        t.id_tarifa,
        t.nombre_tarifa,
        t.ocupacion_base,
        t.incluye,
        COALESCE(t.precio_base, 0) AS precio_base,
        COALESCE(t.estado, 'Activa') AS estado,
        COALESCE(t.iva, 16) AS iva,
        COALESCE(t.huesped_adicional, 0) AS huesped_adicional,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id_temporada', tp.id_temporada, 'nombre_temporada', tp.nombre_temporada, 'fecha_inicio', tp.fecha_inicio, 'fecha_fin', tp.fecha_fin)) 
          FILTER (WHERE tp.id_temporada IS NOT NULL), '[]'
        ) AS temporadas,
        thab.id_tipo_habitacion,
        COALESCE(thab.nombre_tipo, 'Sin asignar') AS nombre_habitacion
      FROM tarifa t
      LEFT JOIN tarifa_temporada tt ON t.id_tarifa = tt.id_tarifa
      LEFT JOIN temporada tp ON tt.id_temporada = tp.id_temporada
      LEFT JOIN tarifa_hab th ON t.id_tarifa = th.id_tarifa
      LEFT JOIN tipo_habitacion thab ON th.id_tipo_hab = thab.id_tipo_habitacion
      GROUP BY t.id_tarifa, thab.id_tipo_habitacion, thab.nombre_tipo
      ORDER BY t.id_tarifa ASC;
    `;

    const resultado = await conexion.query(consultaSQL);
    
    // Mapeo para formatear temporadas como texto y arreglo para la interfaz
    const tarifasMapeadas = resultado.rows.map(row => ({
      ...row,
      id_temporada: row.temporadas[0]?.id_temporada || null,
      nombre_temporada: row.temporadas.map(tp => tp.nombre_temporada).join(', ') || 'Sin temporada',
      id_temporadas: row.temporadas.map(tp => tp.id_temporada)
    }));

    return respuesta.status(200).json(tarifasMapeadas);
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
        t.incluye,
        COALESCE(t.precio_base, 0) AS precio_base,
        COALESCE(t.estado, 'Activa') AS estado,
        COALESCE(t.iva, 16) AS iva,
        COALESCE(t.huesped_adicional, 0) AS huesped_adicional,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id_temporada', tp.id_temporada, 'nombre_temporada', tp.nombre_temporada, 'fecha_inicio', tp.fecha_inicio, 'fecha_fin', tp.fecha_fin)) 
          FILTER (WHERE tp.id_temporada IS NOT NULL), '[]'
        ) AS temporadas,
        thab.id_tipo_habitacion,
        COALESCE(thab.nombre_tipo, 'Sin asignar') AS nombre_habitacion
      FROM tarifa t
      LEFT JOIN tarifa_temporada tt ON t.id_tarifa = tt.id_tarifa
      LEFT JOIN temporada tp ON tt.id_temporada = tp.id_temporada
      LEFT JOIN tarifa_hab th ON t.id_tarifa = th.id_tarifa
      LEFT JOIN tipo_habitacion thab ON th.id_tipo_hab = thab.id_tipo_habitacion
      WHERE t.id_tarifa = $1
      GROUP BY t.id_tarifa, thab.id_tipo_habitacion, thab.nombre_tipo;
    `;

    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Tarifa no encontrada.' });
    }

    const row = resultado.rows[0];
    const tarifaFormateada = {
      ...row,
      id_temporada: row.temporadas[0]?.id_temporada || null,
      nombre_temporada: row.temporadas.map(tp => tp.nombre_temporada).join(', ') || 'Sin temporada',
      id_temporadas: row.temporadas.map(tp => tp.id_temporada)
    };

    return respuesta.status(200).json(tarifaFormateada);
  } catch (error) {
    console.error(`Error al obtener tarifa ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al obtener los datos de la tarifa.' });
  }
};

// 3. Catálogo de tipos de habitación
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

// 4. Catálogo de temporadas
const obtenerTemporadas = async (peticion, respuesta) => {
  try {
    const resultado = await conexion.query('SELECT * FROM temporada ORDER BY id_temporada ASC;');
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener temporadas:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar las temporadas.' });
  }
};

const guardarCalendarioTemporadas = async (peticion, respuesta) => {
  const { temporadas_altas } = peticion.body; // Recibe un array de temporadas altas configuradas
  const idUsuario = peticion.body.id_usuario || peticion.query.id_usuario || 1;

  try {
    
    for (const temp of temporadas_altas) {
      const inicioMMDD = temp.fecha_inicio.slice(5, 10);
      const finMMDD = temp.fecha_fin.slice(5, 10);
      
      await conexion.query(`
        INSERT INTO temporada (nombre_temporada, fecha_inicio, fecha_fin, descripcion)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (nombre_temporada) DO UPDATE 
        SET fecha_inicio = EXCLUDED.fecha_inicio, fecha_fin = EXCLUDED.fecha_fin, descripcion = EXCLUDED.descripcion;
      `, [temp.nombre_temporada.trim(), inicioMMDD, finMMDD, temp.descripcion || 'Temporada Alta']);
    }

    await conexion.query(`
      INSERT INTO temporada (nombre_temporada, fecha_inicio, fecha_fin, descripcion)
      VALUES ('Temporada Baja (General)', '01-01', '12-31', 'Asignada automáticamente por el sistema para fechas no cubiertas en alta')
      ON CONFLICT (nombre_temporada) DO NOTHING;
    `);

    await registrarAuditoria(idUsuario, 6, 'Actualizó el calendario anual de temporadas y autocompletó temporada baja');

    return respuesta.status(200).json({ mensaje: 'Calendario de temporadas guardado y temporada baja autocompletada con éxito.' });
  } catch (error) {
    console.error('Error al guardar calendario:', error);
    return respuesta.status(500).json({ mensaje: 'Error interno al procesar el calendario de temporadas.' });
  }
};

const crearTemporada = async (peticion, respuesta) => {
  const { nombre_temporada, fecha_inicio, fecha_fin, descripcion } = peticion.body;

  if (!nombre_temporada || !fecha_inicio || !fecha_fin) {
    return respuesta.status(400).json({ mensaje: 'Todos los campos de fecha de la temporada son obligatorios.' });
  }

  try {
    const resultado = await conexion.query(`
      INSERT INTO temporada (nombre_temporada, fecha_inicio, fecha_fin, descripcion)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `, [nombre_temporada.trim(), fecha_inicio, fecha_fin, descripcion ? descripcion.trim() : '']);

    const idUsuario = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(idUsuario, 6, `Creó la temporada "${nombre_temporada.trim()}"`);

    return respuesta.status(201).json({ mensaje: 'Temporada registrada exitosamente.', temporada: resultado.rows[0] });
  } catch (error) {
    console.error('Error al crear temporada:', error);
    if (error.code === '23505') {
      return respuesta.status(400).json({ mensaje: 'Ya existe una temporada con ese nombre.' });
    }
    return respuesta.status(500).json({ mensaje: 'Error interno al guardar la temporada.' });
  }
};

// 5. Crear una nueva tarifa (Validando duplicados por tipo de habitación y temporada)
const crearTarifa = async (peticion, respuesta) => {
  const { 
    nombre_tarifa, 
    id_temporada,
    id_temporadas,
    id_tipo_habitacion, 
    precio_base, 
    iva, 
    ocupacion_base, 
    huesped_adicional, 
    incluye, 
    estado 
  } = peticion.body;

  let temporadasArray = [];
  if (Array.isArray(id_temporadas)) {
    temporadasArray = id_temporadas;
  } else if (id_temporada) {
    temporadasArray = [id_temporada];
  }

  if (!nombre_tarifa || temporadasArray.length === 0 || !id_tipo_habitacion) {
    return respuesta.status(400).json({
      mensaje: 'El nombre de la tarifa, al menos una temporada y la habitación son obligatorios.'
    });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    // VALIDACIÓN: Verificar si ya existe una tarifa para este tipo de habitación en cualquiera de las temporadas seleccionadas
    for (const idTemp of temporadasArray) {
      const duplicadaCheck = await cliente.query(`
        SELECT t.nombre_tarifa 
        FROM tarifa t
        JOIN tarifa_temporada tt ON t.id_tarifa = tt.id_tarifa
        JOIN tarifa_hab th ON t.id_tarifa = th.id_tarifa
        WHERE tt.id_temporada = $1 AND th.id_tipo_hab = $2
      `, [parseInt(idTemp), parseInt(id_tipo_habitacion)]);

      if (duplicadaCheck.rows.length > 0) {
        await cliente.query('ROLLBACK');
        return respuesta.status(400).json({
          mensaje: `Ya existe una tarifa definida ("${duplicadaCheck.rows[0].nombre_tarifa}") para este tipo de habitación en la temporada seleccionada.`
        });
      }
    }

    const consultaTarifa = `
      INSERT INTO tarifa (
        nombre_tarifa, 
        ocupacion_base, 
        incluye, 
        precio_base, 
        estado, 
        iva, 
        huesped_adicional
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id_tarifa;
    `;

    const resultadoTarifa = await cliente.query(consultaTarifa, [
      nombre_tarifa.trim(),
      parseInt(ocupacion_base) || 1,
      incluye ? incluye.trim() : '',
      parseFloat(precio_base) || 120.00,
      estado || 'Activa',
      parseFloat(iva) || 16.00,
      parseFloat(huesped_adicional) || 15.00
    ]);

    const idNuevaTarifa = resultadoTarifa.rows[0].id_tarifa;

    // Vincular temporadas
    for (const idTemp of temporadasArray) {
      await cliente.query(`
        INSERT INTO tarifa_temporada (id_tarifa, id_temporada)
        VALUES ($1, $2)
        ON CONFLICT (id_tarifa, id_temporada) DO NOTHING;
      `, [idNuevaTarifa, parseInt(idTemp)]);
    }

    // Vincular habitación
    if (id_tipo_habitacion) {
      await cliente.query(`
        INSERT INTO tarifa_hab (id_tarifa, id_tipo_hab)
        VALUES ($1, $2)
        ON CONFLICT (id_tarifa, id_tipo_hab) DO NOTHING;
      `, [idNuevaTarifa, parseInt(id_tipo_habitacion)]);
    }

    await cliente.query('COMMIT');

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

// 6. Actualizar tarifa existente (Validando duplicados excluyendo la misma tarifa)
const actualizarTarifa = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { 
    nombre_tarifa, 
    id_temporada,
    id_temporadas,
    id_tipo_habitacion, 
    precio_base, 
    iva, 
    ocupacion_base, 
    huesped_adicional, 
    incluye, 
    estado 
  } = peticion.body;

  let temporadasArray = [];
  if (Array.isArray(id_temporadas)) {
    temporadasArray = id_temporadas;
  } else if (id_temporada) {
    temporadasArray = [id_temporada];
  }

  if (!nombre_tarifa || temporadasArray.length === 0 || !id_tipo_habitacion) {
    return respuesta.status(400).json({
      mensaje: 'El nombre de la tarifa, al menos una temporada y la habitación son obligatorios.'
    });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    // VALIDACIÓN: Verificar si ya existe OTRA tarifa con el mismo tipo de habitación y temporada
    for (const idTemp of temporadasArray) {
      const duplicadaCheck = await cliente.query(`
        SELECT t.nombre_tarifa 
        FROM tarifa t
        JOIN tarifa_temporada tt ON t.id_tarifa = tt.id_tarifa
        JOIN tarifa_hab th ON t.id_tarifa = th.id_tarifa
        WHERE tt.id_temporada = $1 AND th.id_tipo_hab = $2 AND t.id_tarifa != $3
      `, [parseInt(idTemp), parseInt(id_tipo_habitacion), parseInt(id)]);

      if (duplicadaCheck.rows.length > 0) {
        await cliente.query('ROLLBACK');
        return respuesta.status(400).json({
          mensaje: `Ya existe otra tarifa definida ("${duplicadaCheck.rows[0].nombre_tarifa}") para este tipo de habitación en la temporada seleccionada.`
        });
      }
    }

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

    const consultaUpdate = `
      UPDATE tarifa
      SET 
        nombre_tarifa = $1,
        ocupacion_base = $2,
        incluye = $3,
        precio_base = $4,
        estado = $5,
        iva = $6,
        huesped_adicional = $7
      WHERE id_tarifa = $8;
    `;

    await cliente.query(consultaUpdate, [
      nombre_tarifa.trim(),
      parseInt(ocupacion_base) || 1,
      incluye ? incluye.trim() : '',
      parseFloat(precio_base) || 0.00,
      estado || 'Activa',
      parseFloat(iva) || 16.00,
      parseFloat(huesped_adicional) || 0.00,
      id
    ]);

    // Actualizar temporadas asociadas
    await cliente.query('DELETE FROM tarifa_temporada WHERE id_tarifa = $1', [id]);
    for (const idTemp of temporadasArray) {
      await cliente.query(`
        INSERT INTO tarifa_temporada (id_tarifa, id_temporada)
        VALUES ($1, $2)
        ON CONFLICT (id_tarifa, id_temporada) DO NOTHING;
      `, [id, parseInt(idTemp)]);
    }

    // Actualizar habitación asociada
    await cliente.query('DELETE FROM tarifa_hab WHERE id_tarifa = $1', [id]);
    if (id_tipo_habitacion) {
      await cliente.query(`
        INSERT INTO tarifa_hab (id_tarifa, id_tipo_hab)
        VALUES ($1, $2);
      `, [id, parseInt(id_tipo_habitacion)]);
    }

    await cliente.query('COMMIT');

    let cambios = [];
    if (tarifaAnterior.nombre_tarifa !== nombre_tarifa.trim()) {
      cambios.push(`nombre de "${tarifaAnterior.nombre_tarifa}" a "${nombre_tarifa.trim()}"`);
    }
    if (String(tarifaAnterior.nombre_habitacion || 'Sin asignar') !== String(nuevaHabitacionNombre)) {
      cambios.push(`habitación asignada a "${nuevaHabitacionNombre}"`);
    }
    if (parseFloat(tarifaAnterior.precio_base) !== parseFloat(precio_base || 0)) {
      cambios.push(`precio base de $${parseFloat(tarifaAnterior.precio_base).toFixed(2)} a $${parseFloat(precio_base || 0).toFixed(2)}`);
    }
    if (String(tarifaAnterior.estado) !== String(estado || 'Activa')) {
      cambios.push(`estado a "${estado || 'Activa'}"`);
    }

    const detalleModificacion = cambios.length > 0 ? cambios.join(', ') : 'actualizó los datos';
    const descripcionAuditoria = `Actualizó la tarifa comercial "${tarifaAnterior.nombre_tarifa}": modificó ${detalleModificacion}.`;

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(idUsuarioResponsable, 6, descripcionAuditoria);

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

const eliminarTarifa = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    // 1. Verificar si la tarifa está asociada a la "Temporada normal" o "Temporada Baja"
    const temporadaAsociadaRes = await cliente.query(`
      SELECT tp.nombre_temporada, t.nombre_tarifa
      FROM tarifa t
      JOIN tarifa_temporada tt ON t.id_tarifa = tt.id_tarifa
      JOIN temporada tp ON tt.id_temporada = tp.id_temporada
      WHERE t.id_tarifa = $1;
    `, [id]);

    for (const row of temporadaAsociadaRes.rows) {
      const nombreTemp = row.nombre_temporada.toLowerCase();
      if (nombreTemp.includes('temporada normal') || nombreTemp.includes('temporada baja')) {
        await cliente.query('ROLLBACK');
        return respuesta.status(400).json({
          mensaje: `No se puede eliminar la tarifa "${row.nombre_tarifa}" porque está vinculada a una temporada base protegida (${row.nombre_temporada}).`
        });
      }
    }

    const tarifaInfoRes = await cliente.query(`
      SELECT t.nombre_tarifa, thab.nombre_tipo AS nombre_habitacion
      FROM tarifa t
      LEFT JOIN tarifa_hab th ON t.id_tarifa = th.id_tarifa
      LEFT JOIN tipo_habitacion thab ON th.id_tipo_hab = thab.id_tipo_habitacion
      WHERE t.id_tarifa = $1;
    `, [id]);

    const tarifaInfo = tarifaInfoRes.rows[0];
    const nombreTarifaEliminada = tarifaInfo ? tarifaInfo.nombre_tarifa : 'una tarifa';

    await cliente.query('DELETE FROM tarifa_temporada WHERE id_tarifa = $1', [id]);
    await cliente.query('DELETE FROM tarifa_hab WHERE id_tarifa = $1', [id]);
    const resultado = await cliente.query('DELETE FROM tarifa WHERE id_tarifa = $1 RETURNING id_tarifa', [id]);

    if (resultado.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'La tarifa a eliminar no existe.' });
    }

    await cliente.query('COMMIT');

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(idUsuarioResponsable, 6, `Eliminó permanentemente la tarifa comercial "${nombreTarifaEliminada}"`);

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

// 8. Duplicar tarifa
const duplicarTarifa = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    const origRes = await cliente.query('SELECT * FROM tarifa WHERE id_tarifa = $1', [id]);
    if (origRes.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'Tarifa original no encontrada.' });
    }

    const orig = origRes.rows[0];
    const nuevoNombre = `${orig.nombre_tarifa} (Copia)`;

    const insRes = await cliente.query(`
      INSERT INTO tarifa (
        nombre_tarifa, 
        ocupacion_base, 
        incluye, 
        precio_base, 
        estado, 
        iva, 
        huesped_adicional
      )
      VALUES ($1, $2, $3, $4, 'Borrador', $5, $6)
      RETURNING id_tarifa;
    `, [
      nuevoNombre,
      orig.ocupacion_base,
      orig.incluye,
      orig.precio_base,
      orig.iva,
      orig.huesped_adicional
    ]);

    const nuevaId = insRes.rows[0].id_tarifa;

    // Copiar temporadas asociadas
    const tempsRes = await cliente.query('SELECT id_temporada FROM tarifa_temporada WHERE id_tarifa = $1', [id]);
    for (const tRow of tempsRes.rows) {
      await cliente.query(`
        INSERT INTO tarifa_temporada (id_tarifa, id_temporada)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [nuevaId, tRow.id_temporada]);
    }

    // Copiar habitación asociada
    const habRes = await cliente.query('SELECT id_tipo_hab FROM tarifa_hab WHERE id_tarifa = $1', [id]);
    if (habRes.rows.length > 0) {
      await cliente.query(`
        INSERT INTO tarifa_hab (id_tarifa, id_tipo_hab)
        VALUES ($1, $2)
      `, [nuevaId, habRes.rows[0].id_tipo_hab]);
    }

    await cliente.query('COMMIT');

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    await registrarAuditoria(idUsuarioResponsable, 6, `Duplicó la tarifa comercial "${orig.nombre_tarifa}" generando la nueva tarifa "${nuevoNombre}" en estado Borrador`);

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

// 9. Consultar Tasa Oficial BCV del día en vivo mediante API pública
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
  obtenerTemporadas,
  crearTemporada,
  crearTarifa,
  actualizarTarifa,
  eliminarTarifa,
  duplicarTarifa,
  obtenerTasaBCV
};