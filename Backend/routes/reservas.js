const express = require('express');
const router = express.Router();
const pool = require('../db');

// Obtener todas las reservas
router.get('/reservas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reserva');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error en el servidor al obtener las reservas' });
  }
});

// Obtener una reserva por ID
router.get('/reservas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM reserva WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Crear una nueva reserva
router.post('/reservas', async (req, res) => {
  try {
    const { cliente_id, habitacion_id, fecha_inicio, fecha_fin, estado } = req.body;
    const nuevaReserva = await pool.query(
      'INSERT INTO reserva (cliente_id, habitacion_id, fecha_inicio, fecha_fin, estado) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [cliente_id, habitacion_id, fecha_inicio, fecha_fin, estado]
    );
    res.status(201).json(nuevaReserva.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error en el servidor al crear la reserva' });
  }
});

// Actualizar una reserva
router.put('/reservas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cliente_id, habitacion_id, fecha_inicio, fecha_fin, estado } = req.body;
    
    const reservaActualizada = await pool.query(
      'UPDATE reserva SET cliente_id = $1, habitacion_id = $2, fecha_inicio = $3, fecha_fin = $4, estado = $5 WHERE id = $6 RETURNING *',
      [cliente_id, habitacion_id, fecha_inicio, fecha_fin, estado, id]
    );
    
    if (reservaActualizada.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada para actualizar' });
    }
    
    res.json(reservaActualizada.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error en el servidor al actualizar la reserva' });
  }
});

// Eliminar una reserva
router.delete('/reservas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const reservaEliminada = await pool.query('DELETE FROM reserva WHERE id = $1 RETURNING *', [id]);
    
    if (reservaEliminada.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada para eliminar' });
    }
    
    res.json({ message: 'Reserva eliminada con éxito' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error en el servidor al eliminar la reserva' });
  }
});

module.exports = router;