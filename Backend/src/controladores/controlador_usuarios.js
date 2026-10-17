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
    console.error('Error al obtener los datos del usuario:', error);
    return respuesta.status(500).json({ mensaje: 'Error al obtener los datos del usuario.' });
  }
};

const crearUsuario = async (peticion, respuesta) => {
  const { id_rol, nombre, correo, contrasenna, estado, id_admin } = peticion.body;

  if (!id_rol || !nombre || !correo || !contrasenna) {
    return respuesta.status(400).json({ mensaje: 'Todos los campos obligatorios del usuario deben completarse.' });
  }

  try {
    // Consultar el nombre del rol para que la auditoría sea más descriptiva
    const consultaRol = `SELECT nombre FROM rol WHERE id_rol = $1;`;
    const resRol = await conexion.query(consultaRol, [id_rol]);
    const nombreRol = resRol.rows[0] ? resRol.rows[0].nombre : 'Rol asignado';

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

    const usuarioCreado = resultado.rows[0];
    const idUsuarioResponsable = id_admin || peticion.body.id_usuario_responsable || 1;

    // Auditoría específica y sin mostrar IDs
    await registrarAuditoria(
      idUsuarioResponsable, 
      'Rol y Usuarios', 
      `Registró al nuevo usuario: ${usuarioCreado.nombre} (${usuarioCreado.correo}) con el rol "${nombreRol}" y estado ${usuarioCreado.estado}`
    );

    return respuesta.status(201).json({
      mensaje: 'Usuario registrado exitosamente.',
      usuario: usuarioCreado
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
  const { id } = peticion.params; // ID del usuario que se está editando
  const { id_rol, nombre, correo, contrasenna, estado, id_admin } = peticion.body;

  if (!id_rol || !nombre || !correo) {
    return respuesta.status(400).json({ mensaje: 'Por favor complete los campos obligatorios.' });
  }

  try {
    // 1. Obtener los datos actuales del usuario antes de actualizar para comparar cambios
    const consultaPrev = `
      SELECT u.*, r.nombre AS nombre_rol 
      FROM usuario u 
      JOIN rol r ON u.id_rol = r.id_rol 
      WHERE u.id_usuario = $1;
    `;
    const resultadoPrev = await conexion.query(consultaPrev, [id]);

    if (resultadoPrev.rows.length === 0) {
      return respuesta.status(404).json({ mensaje: 'El usuario a actualizar no existe.' });
    }

    const usuarioAnterior = resultadoPrev.rows[0];

    // Consultar el nombre del nuevo rol
    const consultaRolNuevo = `SELECT nombre FROM rol WHERE id_rol = $1;`;
    const resultadoRolNuevo = await conexion.query(consultaRolNuevo, [id_rol]);
    const nombreRolNuevo = resultadoRolNuevo.rows[0] ? resultadoRolNuevo.rows[0].nombre : 'Rol desconocido';

    // 2. Ejecutar la actualización
    let consultaSQL = '';
    let parametros = [];

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
    const usuarioActualizado = resultado.rows[0];

    // 3. Detectar exactamente qué modificaciones se hicieron
    let cambios = [];
    if (usuarioAnterior.nombre !== nombre.trim()) {
      cambios.push(`nombre de "${usuarioAnterior.nombre}" a "${nombre.trim()}"`);
    }
    if (usuarioAnterior.correo !== correo.trim().toLowerCase()) {
      cambios.push(`correo de "${usuarioAnterior.correo}" a "${correo.trim().toLowerCase()}"`);
    }
    if (usuarioAnterior.id_rol !== parseInt(id_rol)) {
      cambios.push(`rol de "${usuarioAnterior.nombre_rol}" a "${nombreRolNuevo}"`);
    }
    const nuevoEstado = estado || 'ACTIVO';
    if (usuarioAnterior.estado !== nuevoEstado) {
      cambios.push(`estado de "${usuarioAnterior.estado}" a "${nuevoEstado}"`);
    }
    if (contrasenna && contrasenna.trim() !== '') {
      cambios.push('actualizó su contraseña');
    }

    const detalleModificacion = cambios.length > 0 ? cambios.join(', ') : 'actualizó sus datos generales sin cambios notables';
    const descripcionAuditoria = `Actualizó al usuario ${usuarioAnterior.nombre}: modificó ${detalleModificacion}.`;

    // 4. Asegurar que el responsable sea el administrador que ejecuta la acción (id_admin) y no el usuario editado
    const idUsuarioResponsable = id_admin || peticion.body.id_usuario_responsable || 1;

    await registrarAuditoria(
      idUsuarioResponsable,
      'Rol y Usuarios',
      descripcionAuditoria
    );

    return respuesta.status(200).json({
      mensaje: 'Usuario actualizado correctamente.',
      usuario: usuarioActualizado
    });
  } catch (error) {
    console.error('Error al actualizar el usuario:', error);
    return respuesta.status(500).json({ mensaje: 'Error al actualizar el usuario.' });
  }
};

const eliminarUsuario = async (peticion, respuesta) => {
  const { id } = peticion.params;
  const { id_admin } = peticion.body;

  try {
    const consultaPrev = await conexion.query('SELECT nombre, correo FROM usuario WHERE id_usuario = $1', [id]);
    const infoUsuario = consultaPrev.rows[0];

    const consultaSQL = `
      DELETE FROM usuario
      WHERE id_usuario = $1
      RETURNING *;
    `;
    const resultado = await conexion.query(consultaSQL, [id]);

    if (resultado.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'El usuario a eliminar no existe.' });
    }

    const nombreEliminado = infoUsuario ? `${infoUsuario.nombre} (${infoUsuario.correo})` : 'un usuario del sistema';
    const idUsuarioResponsable = id_admin || peticion.body.id_usuario_responsable || 1;

    // Auditoría específica y sin IDs
    await registrarAuditoria(
      idUsuarioResponsable, 
      'Rol y Usuarios', 
      `Eliminó permanentemente al usuario: ${nombreEliminado}`
    );

    return respuesta.status(200).json({
      mensaje: 'Usuario eliminado correctamente.',
      usuario: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al eliminar el usuario:', error);

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

    await registrarAuditoria(usuario.id_usuario, 'Rol y Usuarios', `Inició sesión exitosamente el usuario ${usuario.nombre} (${usuario.correo})`);

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

const registrarCierreSesion = async (peticion, respuesta) => {
  const { id_usuario } = peticion.body;
  try {
    const usuarioRes = await conexion.query('SELECT nombre FROM usuario WHERE id_usuario = $1', [id_usuario || 1]);
    const nombreUsuario = usuarioRes.rows[0]?.nombre || 'Usuario';

    await registrarAuditoria(
      id_usuario || 1,
      'Usuarios y Roles',
      `El usuario ${nombreUsuario} cerró sesión en el sistema`
    );

    return respuesta.status(200).json({ mensaje: 'Cierre de sesión registrado en auditoría.' });
  } catch (error) {
    console.error('Error al registrar cierre de sesión:', error);
    return respuesta.status(500).json({ mensaje: 'Error interno en el servidor.' });
  }
};

module.exports = {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  iniciarSesion,
  registrarCierreSesion
};