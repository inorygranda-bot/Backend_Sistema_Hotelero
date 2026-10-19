const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');

// 1. Obtener todas las temporadas
const obtenerTemporadas = async (peticion, respuesta) => {
  try {
    const resultado = await conexion.query('SELECT * FROM temporada ORDER BY id_temporada ASC;');
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener temporadas:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar las temporadas.' });
  }
};

// 2. Crear una nueva temporada
const crearTemporada = async (peticion, respuesta) => {
  const { nombre_temporada, fecha_inicio, fecha_fin, descripcion } = peticion.body;

  if (!nombre_temporada || !fecha_inicio || !fecha_fin) {
    return respuesta.status(400).json({ mensaje: 'El nombre y los rangos de fecha son obligatorios.' });
  }

  const inicioMMDD = fecha_inicio === 'N/A' ? 'N/A' : fecha_inicio.slice(5, 10);
  const finMMDD = fecha_fin === 'N/A' ? 'N/A' : fecha_fin.slice(5, 10);

  try {
    const resultado = await conexion.query(`
      INSERT INTO temporada (nombre_temporada, fecha_inicio, fecha_fin, descripcion)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `, [nombre_temporada.trim(), inicioMMDD, finMMDD, descripcion ? descripcion.trim() : '']);

    const idUsuario = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    // Auditoría más específica con fechas y descripción
    await registrarAuditoria(idUsuario, 6, `Creó la temporada "${nombre_temporada.trim()}" con vigencia del ${inicioMMDD} al ${finMMDD}`);

    return respuesta.status(201).json({ mensaje: 'Temporada registrada exitosamente.', temporada: resultado.rows[0] });
  } catch (error) {
    console.error('Error al crear temporada:', error);
    if (error.code === '23505') {
      return respuesta.status(400).json({ mensaje: 'Ya existe una temporada con ese nombre.' });
    }
    return respuesta.status(500).json({ mensaje: 'Error interno al guardar la temporada.' });
  }
};

// 3. Guardar calendario masivo y asegurar Temporada Baja por defecto
const guardarCalendarioTemporadas = async (peticion, respuesta) => {
  const { temporadas_altas } = peticion.body;
  const idUsuario = peticion.body.id_usuario || peticion.query.id_usuario || 1;

  if (!temporadas_altas || !Array.isArray(temporadas_altas)) {
    return respuesta.status(400).json({ mensaje: 'No se recibieron los datos de las temporadas.' });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    for (const temp of temporadas_altas) {
      const inicioMMDD = temp.fecha_inicio.slice(5, 10);
      const finMMDD = temp.fecha_fin.slice(5, 10);
      
      await cliente.query(`
        INSERT INTO temporada (nombre_temporada, fecha_inicio, fecha_fin, descripcion)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (nombre_temporada) DO UPDATE 
        SET fecha_inicio = EXCLUDED.fecha_inicio, fecha_fin = EXCLUDED.fecha_fin, descripcion = EXCLUDED.descripcion;
      `, [temp.nombre_temporada.trim(), inicioMMDD, finMMDD, temp.descripcion || 'Temporada Alta']);
    }

    // Asegurar comodín de respaldo Temporada Baja
    await cliente.query(`
      INSERT INTO temporada (nombre_temporada, fecha_inicio, fecha_fin, descripcion)
      VALUES ('Temporada Baja', 'N/A', 'N/A', 'Comodín de respaldo automático para fechas sin temporada alta explícita')
      ON CONFLICT (nombre_temporada) DO NOTHING;
    `);

    await cliente.query('COMMIT');
    // Auditoría detallando la cantidad de temporadas procesadas
    await registrarAuditoria(idUsuario, 6, `Actualizó masivamente el calendario de temporadas (${temporadas_altas.length} temporadas procesadas)`);

    return respuesta.status(200).json({ mensaje: 'Calendario de temporadas guardado exitosamente.' });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al guardar calendario:', error);
    return respuesta.status(500).json({ mensaje: 'Error interno al procesar el calendario.' });
  } finally {
    cliente.release();
  }
};

// 4. Actualizar temporada existente
const actualizarTemporada = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { nombre_temporada, fecha_inicio, fecha_fin, descripcion } = peticion.body;

  if (!nombre_temporada || !fecha_inicio || !fecha_fin) {
    return respuesta.status(400).json({ mensaje: 'Todos los campos son obligatorios.' });
  }

  const inicioMMDD = fecha_inicio === 'N/A' ? 'N/A' : fecha_inicio.slice(5, 10);
  const finMMDD = fecha_fin === 'N/A' ? 'N/A' : fecha_fin.slice(5, 10);

  try {
    const resultado = await conexion.query(`
      UPDATE temporada
      SET nombre_temporada = $1, fecha_inicio = $2, fecha_fin = $3, descripcion = $4
      WHERE id_temporada = $5
      RETURNING *;
    `, [nombre_temporada.trim(), inicioMMDD, finMMDD, descripcion ? descripcion.trim() : '', id]);

    if (resultado.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'La temporada no existe.' });
    }

    const idUsuario = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    // Auditoría específica con los nuevos valores de fechas
    await registrarAuditoria(idUsuario, 6, `Actualizó la temporada ID ${id} ("${nombre_temporada.trim()}") con nuevo rango del ${inicioMMDD} al ${finMMDD}`);

    return respuesta.status(200).json({ mensaje: 'Temporada actualizada correctamente.', temporada: resultado.rows[0] });
  } catch (error) {
    console.error('Error al actualizar temporada:', error);
    return respuesta.status(500).json({ mensaje: 'Error interno al actualizar la temporada.' });
  }
};

// 5. Eliminar temporada con manejo seguro y protección de la temporada por defecto
const eliminarTemporada = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    // Verificar el nombre de la temporada antes de borrar
    const temporadaCheck = await cliente.query('SELECT nombre_temporada FROM temporada WHERE id_temporada = $1', [id]);
    if (temporadaCheck.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'La temporada no existe.' });
    }

    const nombreTempOriginal = temporadaCheck.rows[0].nombre_temporada;
    const nombreTempLower = nombreTempOriginal.toLowerCase();
    
    if (nombreTempLower.includes('temporada normal') || nombreTempLower.includes('temporada baja')) {
      await cliente.query('ROLLBACK');
      return respuesta.status(400).json({ 
        mensaje: 'No se puede eliminar la temporada base o por defecto del sistema ya que es necesaria para las reservas generales.' 
      });
    }

    // Verificar si está en uso en tarifas
    const usoCheck = await cliente.query('SELECT COUNT(*) FROM tarifa_temporada WHERE id_temporada = $1', [id]);
    const estaEnUso = parseInt(usoCheck.rows[0].count) > 0;

    if (estaEnUso) {
      await cliente.query('DELETE FROM tarifa_temporada WHERE id_temporada = $1', [id]);
    }

    const resultado = await cliente.query('DELETE FROM temporada WHERE id_temporada = $1 RETURNING *;', [id]);
    await cliente.query('COMMIT');

    const idUsuario = peticion.body.id_usuario || peticion.query.id_usuario || 1;
    // Auditoría específica indicando el nombre exacto de la temporada eliminada
    await registrarAuditoria(idUsuario, 6, `Eliminó permanentemente la temporada "${nombreTempOriginal}" (ID: ${id})`);

    return respuesta.status(200).json({ mensaje: 'Temporada eliminada exitosamente.' });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al eliminar temporada:', error);
    return respuesta.status(500).json({ mensaje: 'Error al eliminar la temporada.' });
  } finally {
    cliente.release();
  }
};

module.exports = {
  obtenerTemporadas,
  crearTemporada,
  guardarCalendarioTemporadas,
  actualizarTemporada,
  eliminarTemporada
};