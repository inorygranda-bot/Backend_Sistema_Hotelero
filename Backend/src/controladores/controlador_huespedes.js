const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');

const obtenerHuespedes = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        h.id_huesped,
        h.tipo_documento,
        dh.num_documento,
        h.nombre,
        h.telefono,
        h.correo,
        h.estado
      FROM huesped h
      LEFT JOIN documento_huesped dh ON h.id_huesped = dh.id_huesped
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
        dh.num_documento,
        h.nombre,
        h.telefono,
        h.correo,
        h.estado
      FROM huesped h
      LEFT JOIN documento_huesped dh ON h.id_huesped = dh.id_huesped
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

  if (!nombre || !tipo_documento || !num_documento || !correo) {
    return respuesta.status(400).json({ 
      mensaje: 'Los campos Nombre, Tipo de Documento, Cédula/Documento y Correo son obligatorios.' 
    });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    const consultaHuesped = `
      INSERT INTO huesped (tipo_documento, nombre, telefono, correo, estado)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id_huesped;
    `;
    const resultadoHuesped = await cliente.query(consultaHuesped, [
      tipo_documento,
      nombre.trim(),
      telefono ? telefono.trim() : '',
      correo.trim(),
      estado || 'ACTIVO'
    ]);

    const idNuevoHuesped = resultadoHuesped.rows[0].id_huesped;

    const consultaDocumento = `
      INSERT INTO documento_huesped (id_huesped, num_documento)
      VALUES ($1, $2);
    `;
    await cliente.query(consultaDocumento, [idNuevoHuesped, num_documento.trim()]);

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    await cliente.query('COMMIT');

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
    await cliente.query('ROLLBACK');
    console.error('Error al registrar huésped:', error);

    if (error.code === '23505') {
      return respuesta.status(400).json({ 
        mensaje: 'El número de documento o correo electrónico ya se encuentra registrado.' 
      });
    }

    return respuesta.status(500).json({ 
      mensaje: 'Error interno al intentar guardar el huésped.' 
    });
  } finally {
    cliente.release();
  }
};

const actualizarHuesped = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { tipo_documento, num_documento, nombre, telefono, correo, estado } = peticion.body;

  if (!nombre || !tipo_documento || !correo) {
    return respuesta.status(400).json({ 
      mensaje: 'Por favor completa todos los campos requeridos.' 
    });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    const huespedAntiguoRes = await cliente.query(`
      SELECT h.nombre, dh.num_documento 
      FROM huesped h 
      LEFT JOIN documento_huesped dh ON h.id_huesped = dh.id_huesped 
      WHERE h.id_huesped = $1
    `, [id]);

    if (huespedAntiguoRes.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'El huésped a actualizar no existe.' });
    }

    const nombreAntiguo = huespedAntiguoRes.rows[0].nombre;

    const consultaHuesped = `
      UPDATE huesped
      SET tipo_documento = $1, nombre = $2, telefono = $3, correo = $4, estado = $5
      WHERE id_huesped = $6;
    `;
    await cliente.query(consultaHuesped, [
      tipo_documento,
      nombre.trim(),
      telefono ? telefono.trim() : '',
      correo.trim(),
      estado || 'ACTIVO',
      id
    ]);

    if (num_documento && num_documento.trim() !== '') {
      const consultaDocumento = `
        INSERT INTO documento_huesped (id_huesped, num_documento)
        VALUES ($1, $2)
        ON CONFLICT (id_huesped) 
        DO UPDATE SET num_documento = EXCLUDED.num_documento;
      `;
      await cliente.query(consultaDocumento, [id, num_documento.trim()]);
    } else {
      await cliente.query('DELETE FROM documento_huesped WHERE id_huesped = $1;', [id]);
    }

    let cambios = [];
    if (nombreAntiguo !== nombre.trim()) cambios.push(`nombre de "${nombreAntiguo}" a "${nombre.trim()}"`);
    if (estado && estado !== 'ACTIVO') cambios.push(`estado a "${estado}"`);
    const detalleCambios = cambios.length > 0 ? cambios.join(', ') : 'actualizó sus datos generales';

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    await cliente.query('COMMIT');

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Huéspedes', 
      `Actualizó la información del huésped "${nombre.trim()}": ${detalleCambios}`
    );

    return respuesta.status(200).json({ mensaje: 'Huésped actualizado correctamente.' });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al actualizar el huésped ID ${id}:`, error);

    if (error.code === '23505') {
      return respuesta.status(400).json({ 
        mensaje: 'El número de documento o correo ya pertenece a otro registro.' 
      });
    }

    return respuesta.status(500).json({ mensaje: 'Error al actualizar el huésped.' });
  } finally {
    cliente.release();
  }
};

const cambiarEstadoHuesped = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { estado } = peticion.body;

  if (!estado || !['ACTIVO', 'INACTIVO'].includes(estado)) {
    return respuesta.status(400).json({ mensaje: 'Estado no válido.' });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    const huespedRes = await cliente.query('SELECT nombre FROM huesped WHERE id_huesped = $1', [id]);
    if (huespedRes.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'Huésped no encontrado.' });
    }
    const nombreHuesped = huespedRes.rows[0].nombre;

    const consultaSQL = `
      UPDATE huesped 
      SET estado = $1 
      WHERE id_huesped = $2;
    `;
    await cliente.query(consultaSQL, [estado, id]);

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    await cliente.query('COMMIT');

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Huéspedes', 
      `Cambió el estado del huésped "${nombreHuesped}" a ${estado}`
    );

    return respuesta.status(200).json({ mensaje: `Huésped marcado como ${estado}.` });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al cambiar estado del huésped ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al cambiar el estado del huésped.' });
  } finally {
    cliente.release();
  }
};

const eliminarHuesped = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    const huespedRes = await cliente.query('SELECT nombre FROM huesped WHERE id_huesped = $1', [id]);
    if (huespedRes.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'El huésped no existe.' });
    }
    const nombreHuesped = huespedRes.rows[0].nombre;

    await cliente.query('DELETE FROM documento_huesped WHERE id_huesped = $1;', [id]);
    await cliente.query('DELETE FROM huesped WHERE id_huesped = $1;', [id]);

    const idUsuarioResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

    await cliente.query('COMMIT');

    await registrarAuditoria(
      idUsuarioResponsable, 
      'Huéspedes', 
      `Eliminó permanentemente al huésped "${nombreHuesped}"`
    );

    return respuesta.status(200).json({ mensaje: 'Huésped eliminado exitosamente.' });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al eliminar huésped ID ${id}:`, error);

    if (error.code === '23503') {
      return respuesta.status(400).json({ 
        mensaje: 'No se puede eliminar el huésped porque tiene reservas registradas. En su lugar, cámbialo a estado INACTIVO.' 
      });
    }

    return respuesta.status(500).json({ mensaje: 'Error interno al intentar eliminar el huésped.' });
  } finally {
    cliente.release();
  }
};

module.exports = {
  obtenerHuespedes,
  obtenerHuespedPorId,
  crearHuesped,
  actualizarHuesped,
  cambiarEstadoHuesped,
  eliminarHuesped
};