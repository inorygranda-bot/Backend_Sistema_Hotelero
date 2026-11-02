const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');

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
    console.error('Error al generar reporte de huéspedes:', error);
    return respuesta.status(500).json({ mensaje: 'Error al generar el reporte de huéspedes en Excel.' });
  }
};
module.exports = {
  obtenerHuespedes,
  obtenerReporteHuespedes, // <--- Tiene que estar aquí
  obtenerHuespedPorId,
  crearHuesped,
  actualizarHuesped,
  cambiarEstadoHuesped,
  eliminarHuesped
};