const conexion = require('../config/conexion');

// Obtener todos los recargos
const obtenerRecargos = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        id_recargo,
        motivo_recargo,
        tipo_operacion,
        tipo_calculo,
        monto
      FROM recargo
      ORDER BY id_recargo ASC;
    `;
    
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener los recargos:', error);
    return respuesta.status(500).json({ 
      mensaje: 'Error al consultar la lista de recargos en la base de datos.' 
    });
  }
};

// Obtener un recargo por su ID
const obtenerRecargoPorId = async (peticion, respuesta) => {
  const { id } = peticion.params;

  try {
    const consultaSQL = `
      SELECT 
        id_recargo,
        motivo_recargo,
        tipo_operacion,
        tipo_calculo,
        monto
      FROM recargo
      WHERE id_recargo = $1;
    `;

    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Recargo no encontrado.' });
    }

    return respuesta.status(200).json(resultado.rows[0]);
  } catch (error) {
    console.error(`Error al obtener el recargo ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al obtener los datos del recargo.' });
  }
};

// Crear un nuevo recargo
const crearRecargo = async (peticion, respuesta) => {
  const { motivo_recargo, tipo_operacion, tipo_calculo, monto } = peticion.body;

  if (!motivo_recargo || !tipo_operacion || !tipo_calculo || monto === undefined || monto === '') {
    return respuesta.status(400).json({ 
      mensaje: 'Todos los campos obligatorios del recargo deben ser completados.' 
    });
  }

  try {
    const consultaSQL = `
      INSERT INTO recargo (motivo_recargo, tipo_operacion, tipo_calculo, monto)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    
    const resultado = await conexion.query(consultaSQL, [
      motivo_recargo.trim(),
      tipo_operacion.trim(),
      tipo_calculo.trim(),
      monto
    ]);

    return respuesta.status(201).json({
      mensaje: 'Recargo registrado exitosamente.',
      recargo: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al registrar el recargo:', error);
    return respuesta.status(500).json({ 
      mensaje: 'Error interno al intentar guardar el recargo.' 
    });
  }
};

// Actualizar un recargo existente
const actualizarRecargo = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { motivo_recargo, tipo_operacion, tipo_calculo, monto } = peticion.body;

  if (!motivo_recargo || !tipo_operacion || !tipo_calculo || monto === undefined || monto === '') {
    return respuesta.status(400).json({ 
      mensaje: 'Por favor completa todos los campos requeridos.' 
    });
  }

  try {
    const consultaSQL = `
      UPDATE recargo
      SET motivo_recargo = $1, tipo_operacion = $2, tipo_calculo = $3, monto = $4
      WHERE id_recargo = $5
      RETURNING *;
    `;
    
    const resultado = await conexion.query(consultaSQL, [
      motivo_recargo.trim(),
      tipo_operacion.trim(),
      tipo_calculo.trim(),
      monto,
      id
    ]);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'El recargo a actualizar no existe.' });
    }

    return respuesta.status(200).json({ 
      mensaje: 'Recargo actualizado correctamente.',
      recargo: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error al actualizar el recargo ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al actualizar el recargo.' });
  }
};

// Eliminar un recargo
const eliminarRecargo = async (peticion, respuesta) => {
  const { id } = peticion.params;

  try {
    const consultaSQL = `
      DELETE FROM recargo
      WHERE id_recargo = $1
      RETURNING *;
    `;

    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'El recargo a eliminar no existe.' });
    }

    return respuesta.status(200).json({
      mensaje: 'Recargo eliminado correctamente.',
      recargo: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error al eliminar el recargo ID ${id}:`, error);

    if (error.code === '23503') {
      return respuesta.status(400).json({
        mensaje: 'No se puede eliminar el recargo porque está asociado a una o más reservas.'
      });
    }

    return respuesta.status(500).json({ mensaje: 'Error al intentar eliminar el recargo.' });
  }
};

module.exports = {
  obtenerRecargos,
  obtenerRecargoPorId,
  crearRecargo,
  actualizarRecargo,
  eliminarRecargo
};