const conexion = require('../config/conexion');
const { registrarAuditoria } = require('./controlador_auditoria');

const obtenerBancos = async (peticion, respuesta) => {
  try {
    const resultado = await conexion.query('SELECT * FROM banco ORDER BY id_banco ASC;');
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener bancos:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar los bancos.' });
  }
};

const crearBanco = async (peticion, respuesta) => {
  const { nombre_banco, id_usuario } = peticion.body;

  if (!nombre_banco || !nombre_banco.trim()) {
    return respuesta.status(400).json({ mensaje: 'El nombre del banco es obligatorio.' });
  }

  try {
    const resultado = await conexion.query(
      'INSERT INTO banco (nombre_banco) VALUES ($1) RETURNING *;',
      [nombre_banco.trim()]
    );

    const bancoCreado = resultado.rows[0];
    const idResponsable = id_usuario || 1;
    const userQuery = await conexion.query('SELECT nombre FROM usuario WHERE id_usuario = $1', [idResponsable]);
    const nombreResponsable = userQuery.rows[0]?.nombre || 'Administrador';

    // 4 es el ID del módulo Finanzas
    await registrarAuditoria(
      idResponsable,
      4,
      `${nombreResponsable} agregó el banco "${bancoCreado.nombre_banco}" al catálogo del sistema.`
    );

    return respuesta.status(201).json({ mensaje: 'Banco registrado exitosamente.', banco: bancoCreado });
  } catch (error) {
    console.error('Error al crear banco:', error);
    if (error.code === '23505') {
      return respuesta.status(400).json({ mensaje: 'Ya existe un banco registrado con ese nombre.' });
    }
    return respuesta.status(500).json({ mensaje: 'Error al registrar el banco.' });
  }
};

const eliminarBanco = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const idResponsable = peticion.body.id_usuario || peticion.query.id_usuario || 1;

  try {
    const bancoPrev = await conexion.query('SELECT nombre_banco FROM banco WHERE id_banco = $1', [id]);
    if (bancoPrev.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'El banco no existe.' });
    }
    const nombreBanco = bancoPrev.rows[0].nombre_banco;

    const resultado = await conexion.query('DELETE FROM banco WHERE id_banco = $1 RETURNING *;', [id]);

    const userQuery = await conexion.query('SELECT nombre FROM usuario WHERE id_usuario = $1', [idResponsable]);
    const nombreResponsable = userQuery.rows[0]?.nombre || 'Administrador';

    await registrarAuditoria(
      idResponsable,
      4,
      `${nombreResponsable} eliminó el banco "${nombreBanco}" del catálogo.`
    );

    return respuesta.status(200).json({ mensaje: 'Banco eliminado correctamente.', banco: resultado.rows[0] });
  } catch (error) {
    console.error('Error al eliminar banco:', error);
    if (error.code === '23503') {
      return respuesta.status(400).json({ mensaje: 'No se puede eliminar el banco porque está asociado a transacciones existentes.' });
    }
    return respuesta.status(500).json({ mensaje: 'Error al eliminar el banco.' });
  }
};

module.exports = {
  obtenerBancos,
  crearBanco,
  eliminarBanco
};