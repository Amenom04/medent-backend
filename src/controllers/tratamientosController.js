const db = require('../config/db');

// Obtener todos los tratamientos/prácticas activas del nomenclador
const obtenerTratamientos = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tratamientos WHERE activo = true ORDER BY categoria, nombre');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener tratamientos:', error);
    res.status(500).json({ error: 'Error al obtener tarifario de tratamientos' });
  }
};

// Crear nuevo tratamiento (Admin / Contabilidad)
const crearTratamiento = async (req, res) => {
  try {
    const { codigo, nombre, categoria, precio } = req.body;
    const result = await db.query(
      `INSERT INTO tratamientos (codigo, nombre, categoria, precio)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [codigo || null, nombre, categoria || 'General', precio || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error al crear tratamiento:', error);
    res.status(500).json({ error: 'Error al crear tratamiento' });
  }
};

module.exports = {
  obtenerTratamientos,
  crearTratamiento
};