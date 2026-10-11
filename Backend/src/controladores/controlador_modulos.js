const conexion = require('../config/conexion');

const obtenerModulosConFunciones = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        m.id_modulo, 
        m.nombre_modulo,
        COALESCE(
          json_agg(
            json_build_object('id_funcion', f.id_funcion, 'nombre_funcion', f.nombre_funcion)
            ORDER BY f.id_funcion
          ) FILTER (WHERE f.id_funcion IS NOT NULL), 
          '[]'
        ) AS funciones
      FROM modulo m
      LEFT JOIN funcion f ON m.id_modulo = f.id_modulo
      GROUP BY m.id_modulo, m.nombre_modulo
      ORDER BY m.id_modulo ASC;
    `;
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener módulos y funciones:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar los módulos y funciones.' });
  }
};

module.exports = { obtenerModulosConFunciones };