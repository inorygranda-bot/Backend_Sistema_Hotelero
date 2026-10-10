const conexion = require('../config/conexion');

const obtenerHabitaciones = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        id_habitacion,
        numero,
        piso,
        tipo,
        capacidad,
        amenidades,
        estado,
        TO_CHAR(ultima_limpieza, 'DD/MM/YYYY HH24:MI') AS ultima_limpieza,
        nombre_huesped,
        TO_CHAR(check_in, 'DD/MM/YYYY') AS check_in,
        TO_CHAR(check_out, 'DD/MM/YYYY') AS check_out,
        saldo_usd,
        saldo_bs
      FROM habitacion
      ORDER BY numero ASC;
    `;
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener habitaciones:', error);
    return respuesta.status(500).json({ 
      mensaje: 'Error al consultar la lista de habitaciones en la base de datos.' 
    });
  }
};

const obtenerHabitacionPorId = async (peticion, respuesta) => {
  const { id } = peticion.params;
  try {
    const consultaSQL = `
      SELECT 
        id_habitacion, numero, piso, tipo, capacidad, amenidades, estado,
        TO_CHAR(ultima_limpieza, 'DD/MM/YYYY HH24:MI') AS ultima_limpieza,
        nombre_huesped,
        TO_CHAR(check_in, 'DD/MM/YYYY') AS check_in,
        TO_CHAR(check_out, 'DD/MM/YYYY') AS check_out,
        saldo_usd, saldo_bs
      FROM habitacion
      WHERE id_habitacion = $1;
    `;
    const resultado = await conexion.query(consultaSQL, [id]);
    if (resultado.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Habitación no encontrada.' });
    }
    return respuesta.status(200).json(resultado.rows[0]);
  } catch (error) {
    console.error(`Error al obtener la habitación ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al obtener los datos de la habitación.' });
  }
};

const crearHabitacion = async (peticion, respuesta) => {
  const { numero, piso, tipo, capacidad, amenidades, estado } = peticion.body;

  if (!numero || !piso || !tipo) {
    return respuesta.status(400).json({ 
      mensaje: 'Los campos Número, Piso y Tipo son obligatorios.' 
    });
  }

  try {
    const consultaSQL = `
      INSERT INTO habitacion (numero, piso, tipo, capacidad, amenidades, estado, ultima_limpieza)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const resultado = await conexion.query(consultaSQL, [
      parseInt(numero),
      parseInt(piso),
      tipo,
      capacidad || null,
      amenidades || null,
      estado || 'Disponible'
    ]);
    return respuesta.status(201).json({
      mensaje: 'Habitación creada exitosamente.',
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al crear habitación:', error);
    if (error.code === '23505') {
      return respuesta.status(400).json({ 
        mensaje: 'Ya existe una habitación con ese número.' 
      });
    }
    return respuesta.status(500).json({ 
      mensaje: 'Error interno al crear la habitación.' 
    });
  }
};

const checkinHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { nombre_huesped } = peticion.body;
  try {
    const check = await conexion.query('SELECT estado FROM habitacion WHERE id_habitacion = $1', [id]);
    if (check.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Habitación no encontrada.' });
    }
    if (check.rows[0].estado !== 'Disponible') {
      return respuesta.status(400).json({ mensaje: 'Solo se puede hacer check-in en habitaciones Disponibles.' });
    }
    const consultaSQL = `
      UPDATE habitacion
      SET estado = 'Ocupada',
          nombre_huesped = $1,
          check_in = CURRENT_DATE,
          check_out = CURRENT_DATE + INTERVAL '3 days',
          saldo_usd = 0,
          saldo_bs = 0
      WHERE id_habitacion = $2
      RETURNING *;
    `;
    const resultado = await conexion.query(consultaSQL, [nombre_huesped || 'Huésped Temporal', id]);
    return respuesta.status(200).json({
      mensaje: 'Check-in realizado correctamente.',
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error en check-in habitación ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al realizar el check-in.' });
  }
};

const checkoutHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;
  try {
    const check = await conexion.query('SELECT estado FROM habitacion WHERE id_habitacion = $1', [id]);
    if (check.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Habitación no encontrada.' });
    }
    if (check.rows[0].estado !== 'Ocupada') {
      return respuesta.status(400).json({ mensaje: 'Solo se puede hacer check-out en habitaciones Ocupadas.' });
    }
    const consultaSQL = `
      UPDATE habitacion
      SET estado = 'Sucia',
          nombre_huesped = NULL,
          check_in = NULL,
          check_out = NULL,
          saldo_usd = 0,
          saldo_bs = 0,
          ultima_limpieza = CURRENT_TIMESTAMP
      WHERE id_habitacion = $1
      RETURNING *;
    `;
    const resultado = await conexion.query(consultaSQL, [id]);
    return respuesta.status(200).json({
      mensaje: 'Check-out realizado. La habitación quedó en estado Sucia.',
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error en check-out habitación ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al realizar el check-out.' });
  }
};

const cambiarEstadoHabitacion = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { estado } = peticion.body;
  const estadosValidos = ['Disponible', 'Ocupada', 'Sucia', 'Fuera de servicio'];

  if (!estado || !estadosValidos.includes(estado)) {
    return respuesta.status(400).json({ mensaje: 'Estado no válido.' });
  }

  try {
    const consultaSQL = `
      UPDATE habitacion
      SET estado = $1,
          nombre_huesped = CASE WHEN $1 IN ('Disponible', 'Sucia', 'Fuera de servicio') THEN NULL ELSE nombre_huesped END,
          check_in = CASE WHEN $1 IN ('Disponible', 'Sucia', 'Fuera de servicio') THEN NULL ELSE check_in END,
          check_out = CASE WHEN $1 IN ('Disponible', 'Sucia', 'Fuera de servicio') THEN NULL ELSE check_out END,
          saldo_usd = CASE WHEN $1 IN ('Disponible', 'Sucia', 'Fuera de servicio') THEN 0 ELSE saldo_usd END,
          saldo_bs = CASE WHEN $1 IN ('Disponible', 'Sucia', 'Fuera de servicio') THEN 0 ELSE saldo_bs END
      WHERE id_habitacion = $2
      RETURNING *;
    `;
    const resultado = await conexion.query(consultaSQL, [estado, id]);
    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'Habitación no encontrada.' });
    }
    return respuesta.status(200).json({
      mensaje: `Habitación marcada como ${estado}.`,
      habitacion: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error al cambiar estado de habitación ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al cambiar el estado de la habitación.' });
  }
};

module.exports = {
  obtenerHabitaciones,
  obtenerHabitacionPorId,
  crearHabitacion,
  checkinHabitacion,
  checkoutHabitacion,
  cambiarEstadoHabitacion
};