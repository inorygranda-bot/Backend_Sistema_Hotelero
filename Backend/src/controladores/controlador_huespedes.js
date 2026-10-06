const conexion = require('../config/conexion');

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

  // Validaciones básicas de campos requeridos
  if (!nombre || !tipo_documento || !num_documento || !correo) {
    return respuesta.status(400).json({ 
      mensaje: 'Los campos Nombre, Tipo de Documento, Cédula/Documento y Correo son obligatorios.' 
    });
  }

  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    // Insertar en la tabla huesped
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

    // Insertar el número de documento en documento_huesped
    const consultaDocumento = `
      INSERT INTO documento_huesped (id_huesped, num_documento)
      VALUES ($1, $2);
    `;
    await cliente.query(consultaDocumento, [idNuevoHuesped, num_documento.trim()]);

    await cliente.query('COMMIT');

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

    // 1. Actualizar tabla huesped
    const consultaHuesped = `
      UPDATE huesped
      SET tipo_documento = $1, nombre = $2, telefono = $3, correo = $4, estado = $5
      WHERE id_huesped = $6;
    `;
    const resultadoHuesped = await cliente.query(consultaHuesped, [
      tipo_documento,
      nombre.trim(),
      telefono ? telefono.trim() : '',
      correo.trim(),
      estado || 'ACTIVO',
      id
    ]);

    if (resultadoHuesped.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'El huésped a actualizar no existe.' });
    }

    // 2. Actualizar o insertar número de documento en documento_huesped
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

    await cliente.query('COMMIT');

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
  const { estado } = peticion.body; // 'ACTIVO' o 'INACTIVO'

  if (!estado || !['ACTIVO', 'INACTIVO'].includes(estado)) {
    return respuesta.status(400).json({ mensaje: 'Estado no válido.' });
  }

  try {
    const consultaSQL = `
      UPDATE huesped 
      SET estado = $1 
      WHERE id_huesped = $2;
    `;
    const resultado = await conexion.query(consultaSQL, [estado, id]);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'Huésped no encontrado.' });
    }

    return respuesta.status(200).json({ mensaje: `Huésped marcado como ${estado}.` });
  } catch (error) {
    console.error(`Error al cambiar estado del huésped ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al cambiar el estado del huésped.' });
  }
};

const eliminarHuesped = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const cliente = await conexion.connect();

  try {
    await cliente.query('BEGIN');

    await cliente.query('DELETE FROM documento_huesped WHERE id_huesped = $1;', [id]);

    const resultado = await cliente.query('DELETE FROM huesped WHERE id_huesped = $1;', [id]);

    if (resultado.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return respuesta.status(404).json({ mensaje: 'El huésped no existe.' });
    }

    await cliente.query('COMMIT');
    return respuesta.status(200).json({ mensaje: 'Huésped eliminado exitosamente.' });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error(`Error al eliminar huésped ID ${id}:`, error);

    // Error 23503 = Llave foránea (El huésped está asociado a una reserva existente)
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