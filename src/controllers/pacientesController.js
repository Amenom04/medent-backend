const db = require('../config/db');

// 1. Obtener todos los pacientes
const obtenerPacientes = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM pacientes ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener pacientes:', error);
    res.status(500).json({ error: 'Error al obtener lista de pacientes' });
  }
};

// 2. Crear nuevo paciente
const crearPaciente = async (req, res) => {
  try {
    const { nombre, apellido, dni, telefono, email, obra_social } = req.body;
    const result = await db.query(
      `INSERT INTO pacientes (nombre, apellido, dni, telefono, email, obra_social)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, apellido, dni, telefono || null, email || null, obra_social || 'Particular']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error al crear paciente:', error);
    res.status(500).json({ error: 'Error al guardar paciente' });
  }
};

// 3. Obtener paciente por ID
const obtenerPacientePorId = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM pacientes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error al obtener paciente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// 4. Obtener archivos del paciente
const obtenerArchivosPaciente = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM archivos_clinicos WHERE paciente_id = $1 ORDER BY id DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener archivos:', error);
    res.status(500).json({ error: 'Error al consultar archivos' });
  }
};

// 5. Subir archivo
const subirArchivoPaciente = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoria } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    const fileUrl = `http://localhost:4000/uploads/${req.file.filename}`;
    const result = await db.query(
      `INSERT INTO archivos_clinicos (paciente_id, nombre_archivo, url, categoria)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, req.file.originalname, fileUrl, categoria || 'placas']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error al registrar archivo:', error);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
};

// 6. Eliminar archivo
const eliminarArchivoPaciente = async (req, res) => {
  try {
    const { archivoId } = req.params;
    await db.query('DELETE FROM archivos_clinicos WHERE id = $1', [archivoId]);
    res.json({ mensaje: 'Archivo eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar archivo:', error);
    res.status(500).json({ error: 'Error al borrar archivo' });
  }
};

// 7. Obtener odontograma
const obtenerOdontogramaPaciente = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM odontogramas WHERE paciente_id = $1 ORDER BY id DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error al obtener odontograma:', error);
    res.status(500).json({ error: 'Error al cargar odontograma' });
  }
};

// 8. Guardar hallazgo en odontograma
const guardarHallazgoOdontograma = async (req, res) => {
  try {
    const { id } = req.params;
    const { numero_diente, seccion, estado, observaciones, notas_diente, costo } = req.body;

    const result = await db.query(
      `INSERT INTO odontogramas (paciente_id, numero_diente, seccion, estado, observaciones, notas_diente, costo)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, numero_diente, seccion || 'general', estado, observaciones || null, notas_diente || null, costo || 0]
    );

    res.status(201).json({ mensaje: 'Hallazgo registrado con éxito', hallazgo: result.rows[0] });
  } catch (error) {
    console.error('❌ Error al guardar hallazgo:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// 9. Eliminar un hallazgo
const eliminarHallazgoOdontograma = async (req, res) => {
  try {
    const { id, hallazgoId } = req.params;
    const result = await db.query(
      'DELETE FROM odontogramas WHERE id = $1 AND paciente_id = $2 RETURNING *',
      [hallazgoId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.json({ mensaje: 'Hallazgo eliminado' });
  } catch (error) {
    console.error('❌ Error al eliminar del odontograma:', error);
    res.status(500).json({ error: 'Error al deshacer cambio' });
  }
};

module.exports = {
  obtenerPacientes,
  crearPaciente,
  obtenerPacientePorId,
  obtenerArchivosPaciente,
  subirArchivoPaciente,
  eliminarArchivoPaciente,
  obtenerOdontogramaPaciente,
  guardarHallazgoOdontograma,
  eliminarHallazgoOdontograma
};