const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
const reservasRoutes = require('./routes/reservas');
app.use('/api', reservasRoutes);

// Servidor escuchando
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor de reservas corriendo en el puerto ${PORT}`);
});