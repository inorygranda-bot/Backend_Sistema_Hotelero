const conexion = require('../config/conexion');
const bcrypt = require('bcrypt');
const { registrarAuditoria } = require('./controlador_auditoria');

const obtenerUsuarios = async (peticion, respuesta) => {
  try {
    const consultaSQL = `
      SELECT 
        u.id_usuario,
        u.id_rol,
        r.nombre AS nombre_rol,
        u.nombre,
        u.correo,
        u.estado
      FROM usuario u
      JOIN rol r ON u.id_rol = r.id_rol
      ORDER BY u.id_usuario ASC;
    `;
    const resultado = await conexion.query(consultaSQL);
    return respuesta.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener los usuarios:', error);
    return respuesta.status(500).json({ mensaje: 'Error al consultar la lista de usuarios.' });
  }
};

const obtenerUsuarioPorId = async (peticion, respuesta) => {
  const { id } = peticion.params;
  try {
    const consultaSQL = `
      SELECT id_usuario, id_rol, nombre, correo, estado
      FROM usuario
      WHERE id_usuario = $1;
    `;
    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }

    return respuesta.status(200).json(resultado.rows[0]);
  } catch (error) {
    console.error(`Error al obtener el usuario ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al obtener los datos del usuario.' });
  }
};

const crearUsuario = async (peticion, respuesta) => {
  
  const { id_rol, nombre, correo, contrasenna, estado } = peticion.body;

  if (!id_rol || !nombre || !correo || !contrasenna) {
    return respuesta.status(400).json({ mensaje: 'Todos los campos obligatorios del usuario deben completarse.' });
  }

  try {
    // Hashear la contraseña de forma segura (10 rondas de salt)
    const salt = await bcrypt.genSalt(10);
    const contrasennaHash = await bcrypt.hash(contrasenna, salt);

    const consultaSQL = `
      INSERT INTO usuario (id_rol, nombre, correo, contrasenna, estado)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id_usuario, id_rol, nombre, correo, estado;
    `;
    const resultado = await conexion.query(consultaSQL, [
      id_rol,
      nombre.trim(),
      correo.trim().toLowerCase(),
      contrasennaHash,
      estado || 'ACTIVO'
    ]);

    await registrarAuditoria(peticion.body.id_usuario || 1, 'Rol y Usuarios', `Registró un nuevo usuario: ${nombre}`);

    return respuesta.status(201).json({
      mensaje: 'Usuario registrado exitosamente.',
      usuario: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);

    if (error.code === '23505') {
      return respuesta.status(400).json({ mensaje: 'El correo electrónico ya se encuentra registrado en el sistema.' });
    }

    return respuesta.status(500).json({ mensaje: 'Error interno al intentar guardar el usuario.' });
  }
};

const actualizarUsuario = async (peticion, respuesta) => {
  
  const { id } = peticion.params;
  const { id_rol, nombre, correo, contrasenna, estado } = peticion.body;

  if (!id_rol || !nombre || !correo) {
    return respuesta.status(400).json({ mensaje: 'Por favor complete los campos obligatorios.' });
  }

  try {
    let consultaSQL = '';
    let parametros = [];

    // Si se proporciona una nueva contraseña, se cifra y actualiza; si no, se conservan los demás datos
    if (contrasenna && contrasenna.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const contrasennaHash = await bcrypt.hash(contrasenna, salt);

      consultaSQL = `
        UPDATE usuario
        SET id_rol = $1, nombre = $2, correo = $3, contrasenna = $4, estado = $5
        WHERE id_usuario = $6
        RETURNING id_usuario, id_rol, nombre, correo, estado;
      `;
      parametros = [id_rol, nombre.trim(), correo.trim().toLowerCase(), contrasennaHash, estado || 'ACTIVO', id];
    } else {
      consultaSQL = `
        UPDATE usuario
        SET id_rol = $1, nombre = $2, correo = $3, estado = $4
        WHERE id_usuario = $5
        RETURNING id_usuario, id_rol, nombre, correo, estado;
      `;
      parametros = [id_rol, nombre.trim(), correo.trim().toLowerCase(), estado || 'ACTIVO', id];
    }

    const resultado = await conexion.query(consultaSQL, parametros);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'El usuario a actualizar no existe.' });
    }

    await registrarAuditoria(peticion.body.id_usuario || 1, 'Rol y Usuarios', `Actualizó los datos del usuario ID ${id}`);

    return respuesta.status(200).json({
      mensaje: 'Usuario actualizado correctamente.',
      usuario: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error al actualizar el usuario ID ${id}:`, error);
    return respuesta.status(500).json({ mensaje: 'Error al actualizar el usuario.' });
  }
};

const eliminarUsuario = async (peticion, respuesta) => {
  
  const { id } = peticion.params;

  try {
    const consultaSQL = `
      DELETE FROM usuario
      WHERE id_usuario = $1
      RETURNING *;
    `;
    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'El usuario a eliminar no existe.' });
    }

    await registrarAuditoria(peticion.body.id_usuario || 1, 'Rol y Usuarios', `Eliminó el usuario ID ${id}`);

    return respuesta.status(200).json({
      mensaje: 'Usuario eliminado correctamente.',
      usuario: resultado.rows[0]
    });
  } catch (error) {
    console.error(`Error al eliminar el usuario ID ${id}:`, error);

    if (error.code === '23503') {
      return respuesta.status(400).json({ mensaje: 'No se puede eliminar el usuario porque tiene reservas, pagos o registros en auditoría asociados.' });
    }

    return respuesta.status(500).json({ mensaje: 'Error al intentar eliminar el usuario.' });
  }
};

const iniciarSesion = async (peticion, respuesta) => {
  
  const { correo, contrasenna } = peticion.body;

  if (!correo || !contrasenna) {
    return respuesta.status(400).json({ mensaje: 'Debe ingresar el correo y la contraseña.' });
  }

  try {
    const consultaSQL = `
      SELECT u.id_usuario, u.id_rol, r.nombre AS nombre_rol, u.nombre, u.correo, u.contrasenna, u.estado
      FROM usuario u
      JOIN rol r ON u.id_rol = r.id_rol
      WHERE u.correo = $1;
    `;
    const resultado = await conexion.query(consultaSQL, [correo.trim().toLowerCase()]);

    if (resultado.rows.length === 0) {
      return respuesta.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
    }

    const usuario = resultado.rows[0];

    if (usuario.estado !== 'ACTIVO') {
      return respuesta.status(403).json({ mensaje: 'El usuario se encuentra inactivo. Contacte al administrador.' });
    }

    const contrasennaValida = await bcrypt.compare(contrasenna, usuario.contrasenna);

    if (!contrasennaValida) {
      return respuesta.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
    }
    await registrarAuditoria(usuario.id_usuario, 'Rol y Usuarios', `Inicio de sesión exitoso del usuario ${usuario.nombre}`);

    // Consultar los IDs de los módulos asignados al rol del usuario
    const consultaModulos = `
      SELECT id_modulo 
      FROM rol_modulo 
      WHERE id_rol = $1;
    `;
    const resModulos = await conexion.query(consultaModulos, [usuario.id_rol]);
    const modulosAsignados = resModulos.rows.map(row => row.id_modulo);

    const { contrasenna: _, ...datosUsuario } = usuario;

    return respuesta.status(200).json({
      mensaje: 'Inicio de sesión exitoso.',
      usuario: {
        ...datosUsuario,
        modulos: modulosAsignados 
      }
    });
  } catch (error) {
    console.error('Error en el inicio de sesión:', error);
    return respuesta.status(500).json({ mensaje: 'Error interno en el servidor al intentar iniciar sesión.' });
  }
};

module.exports = {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  iniciarSesion
};