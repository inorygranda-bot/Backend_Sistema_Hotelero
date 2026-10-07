const { Pool } = require('pg');
require('dotenv').config();

const conexion = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

conexion.on('connect', () => {
  console.log('Conectado a la base de datos PostgreSQL');
});

module.exports = conexion;