const conexion = require('../config/conexion');

const obtenerModulosConFunciones = async (peticion, respuesta) => {
  try {
    const resModulos = await conexion.query('SELECT * FROM modulo ORDER BY id_modulo ASC;');
    const modulos = resModulos.rows;

    for (let modulo of modulos) {
      const resFunciones = await conexion.query(
        'SELECT id_funcion, id_modulo, nombre_funcion FROM funcion WHERE id_modulo = $1 ORDER BY id_funcion ASC;',
        [modulo.id_modulo]
      );
      modulo.funciones = resFunciones.rows;
    }

    return respuesta.status(200).json(modulos);
  } catch (error) {
    console.error('Error al obtener módulos y funciones:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar los módulos del sistema.' });
  }
};

module.exports = {
  obtenerModulosConFunciones
};