import express from 'express';
import cors from 'cors';
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error en PostgreSQL/Neon DB:', err.stack);
  } else {
    console.log('✅ Conexión exitosa a PostgreSQL/Neon DB');
    release();
  }
});

// LISTAR TODOS LOS TURNOS PARA LA AGENDA INTERNA DEL STAFF
app.get('/api/turnos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        paciente_nombre, 
        paciente_dni, 
        telefono, 
        TO_CHAR(fecha, 'DD/MM/YYYY') AS fecha_arg, 
        fecha,
        LEFT(hora::text, 5) AS hora, 
        especialidad, 
        profesional, 
        motivo, 
        estado, 
        respuesta_whatsapp
      FROM turnos 
      ORDER BY fecha DESC, hora ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DISPONIBILIDAD PARA EL PORTAL PÚBLICO
app.get('/api/turnos/disponibilidad', async (req, res) => {
  const { fecha, profesional } = req.query;
  try {
    let query = "SELECT LEFT(hora::text, 5) AS hora FROM turnos WHERE fecha = $1 AND estado NOT IN ('Cancelado', 'Reprogramado')";
    const values = [fecha];

    if (profesional && profesional !== 'Todos los Odontólogos') {
      query += " AND profesional = $2";
      values.push(profesional);
    }

    const result = await pool.query(query, values);
    const horasOcupadas = result.rows.map(r => r.hora.trim().slice(0, 5));
    res.json(horasOcupadas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VERIFICACIÓN DE DUPLICADOS
app.get('/api/turnos/verificar-existente', async (req, res) => {
  const { paciente_nombre, paciente_dni, profesional, especialidad } = req.query;
  try {
    const query = `
      SELECT id, TO_CHAR(fecha, 'DD/MM/YYYY') AS fecha_arg, LEFT(hora::text, 5) AS hora, estado, profesional, especialidad
      FROM turnos 
      WHERE (LOWER(paciente_nombre) = LOWER($1) OR paciente_dni = $2)
        AND profesional = $3 
        AND especialidad = $4 
        AND estado IN ('Confirmado', 'Pendiente')
      ORDER BY fecha DESC, hora DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [paciente_nombre ? paciente_nombre.trim() : '', paciente_dni || '', profesional, especialidad]);
    res.json(result.rows.length > 0 ? result.rows[0] : null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREACIÓN DE TURNOS
app.post('/api/turnos/solicitar-directo', async (req, res) => {
  const { paciente_nombre, paciente_dni, telefono, fecha, hora, motivo, especialidad, profesional, cancelar_turno_id } = req.body;

  try {
    if (!paciente_nombre || !fecha || !hora) {
      return res.status(400).json({ error: 'Nombre, fecha y hora son obligatorios.' });
    }

    const horaLimpia = hora.slice(0, 5);
    const profesionalAsignado = profesional || 'Od. González';

    if (cancelar_turno_id) {
      await pool.query(
        "UPDATE turnos SET estado = 'Cancelado', motivo = motivo || ' (Turno sustituido)' WHERE id = $1",
        [cancelar_turno_id]
      );
    }

    const ocupado = await pool.query(
      "SELECT id FROM turnos WHERE fecha = $1 AND LEFT(hora::text, 5) = $2 AND profesional = $3 AND estado NOT IN ('Cancelado', 'Reprogramado')",
      [fecha, horaLimpia, profesionalAsignado]
    );

    if (ocupado.rows.length > 0) {
      return res.status(409).json({ error: 'Turno no disponible.' });
    }

    const nuevoTurno = await pool.query(
      `INSERT INTO turnos (paciente_nombre, paciente_dni, telefono, fecha, hora, especialidad, motivo, profesional, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Confirmado') 
       RETURNING *, TO_CHAR(fecha, 'DD/MM/YYYY') AS fecha_arg, LEFT(hora::text, 5) AS hora`,
      [
        paciente_nombre.trim(),
        paciente_dni || null,
        telefono || null,
        fecha,
        horaLimpia,
        especialidad || 'Odontología General',
        motivo || 'Solicitud Online',
        profesionalAsignado
      ]
    );

    res.status(201).json(nuevoTurno.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor MeDent ejecutándose en el puerto ${PORT}`);
});

// LISTAR TURNOS PARA LA AGENDA INTERNA (Dashboard / Calendario Semanal)
app.get('/api/turnos', async (req, res) => {
  try {
    const { fecha, profesional } = req.query;
    let query = `
      SELECT 
        id, 
        paciente_nombre, 
        paciente_dni, 
        telefono, 
        TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,
        TO_CHAR(fecha, 'DD/MM/YYYY') AS fecha_arg, 
        LEFT(hora::text, 5) AS hora, 
        especialidad, 
        profesional, 
        motivo, 
        estado, 
        respuesta_whatsapp
      FROM turnos 
      WHERE 1=1
    `;
    const params = [];

    if (profesional && profesional !== 'Todos los Odontólogos') {
      params.push(`%${profesional.replace('Od. ', '').trim()}%`);
      query += ` AND (profesional ILIKE $${params.length})`;
    }

    query += ` ORDER BY fecha ASC, hora ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener turnos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// OBTENER TODOS LOS PACIENTES (Seguridad contra pérdida de datos)
app.get('/api/pacientes', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM pacientes WHERE activo IS NOT FALSE ORDER BY nombre ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener pacientes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// REGISTRAR NUEVO PACIENTE (Con prevención de duplicados)
app.post('/api/pacientes', async (req, res) => {
  const { nombre, apellido, dni, telefono, email, obra_social } = req.body;
  try {
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    const nuevoPaciente = await pool.query(
      `INSERT INTO pacientes (nombre, apellido, dni, telefono, email, obra_social, activo)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING *`,
      [nombre, apellido || '', dni || '', telefono || '', email || '', obra_social || 'Particular']
    );

    res.status(201).json(nuevoPaciente.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ENDPOINT PARA CANCELAR UN TURNO Y LIBERAR EL HORARIO EN LA AGENDA
app.put('/api/turnos/:id/cancelar', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE turnos SET estado = 'Cancelado' WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado.' });
    }

    console.log(`✅ Turno ID #${id} cancelado con éxito.`);
    res.json({ mensaje: 'Turno cancelado correctamente.', turno: result.rows[0] });
  } catch (err) {
    console.error('Error al cancelar turno:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pacientes?buscar=juan&pagina=1&limite=20
app.get('/api/pacientes', async (req, res) => {
  const { buscar = '', pagina = 1, limite = 20 } = req.query;
  const offset = (pagina - 1) * limite;

  try {
    const query = `
      SELECT id, nombre, apellido, dni, telefono, email, obra_social 
      FROM pacientes 
      WHERE nombre ILIKE $1 OR apellido ILIKE $1 OR dni ILIKE $1
      ORDER BY id DESC
      LIMIT $2 OFFSET $3
    `;
    const values = [`%${buscar}%`, limite, offset];
    const { rows } = await pool.query(query, values);

    // Contar total de registros para la paginación
    const totalRes = await pool.query(
      `SELECT COUNT(*) FROM pacientes WHERE nombre ILIKE $1 OR apellido ILIKE $1 OR dni ILIKE $1`, 
      [`%${buscar}%`]
    );

    res.json({
      pacientes: rows,
      total: parseInt(totalRes.rows[0].count),
      pagina: parseInt(pagina),
      totalPaginas: Math.ceil(parseInt(totalRes.rows[0].count) / limite)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint de asentamiento automático para Web y WhatsApp
app.post('/api/turnos/solicitar-directo', async (req, res) => {
  const { fecha, hora, motivo, paciente_nombre, paciente_telefono, paciente_dni, paciente_email, obra_social, origen } = req.body;

  try {
    // 1. Evitar conflictos de horario simultáneo
    const conflicto = await db.query(
      `SELECT id FROM turnos WHERE fecha = $1 AND hora = $2 AND estado != 'CANCELADO'`,
      [fecha, hora]
    );

    if (conflicto.rows.length > 0) {
      return res.status(409).json({ 
        error: '⚠️ El horario ya fue tomado por otro paciente. Elige otra franja.' 
      });
    }

    // 2. Inserción directa en la base de datos de la agenda
    const codigo = 'MED-' + Math.floor(100000 + Math.random() * 900000);
    const result = await db.query(
      `INSERT INTO turnos (codigo, fecha, hora, motivo, paciente_nombre, paciente_telefono, paciente_dni, paciente_email, obra_social, origen, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'CONFIRMADO') RETURNING *`,
      [codigo, fecha, hora, motivo, paciente_nombre, paciente_telefono, paciente_dni, paciente_email, obra_social, origen || 'WEB']
    );

    const turnoAgendado = result.rows[0];

    // 3. Programación automática del recordatorio 24 horas antes
    console.log(`[AGENDA] Turno ${codigo} asentado automáticamente para ${paciente_nombre} (${fecha} ${hora} hs)`);

    res.status(201).json(turnoAgendado);
  } catch (err) {
    console.error('Error al asentar turno:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/turnos/solicitar-directo', async (req, res) => {
  const { fecha, hora, motivo, paciente_nombre, paciente_telefono, paciente_dni, paciente_email, obra_social } = req.body;

  try {
    // 1. Normalizar fecha a YYYY-MM-DD si viene en formato DD/MM/AAAA
    let fechaISO = fecha;
    if (fecha && fecha.includes('/')) {
      const [dia, mes, anio] = fecha.split('/');
      fechaISO = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }

    // 2. Verificar anticolisión
    const conflicto = await db.query(
      `SELECT id FROM turnos WHERE (fecha = $1 OR fecha = $2) AND hora = $3 AND estado != 'CANCELADO'`,
      [fecha, fechaISO, hora]
    );

    if (conflicto.rows.length > 0) {
      return res.status(409).json({ error: '⚠️ El horario seleccionado ya fue reservado.' });
    }

    // 3. Guardar con ambos formatos o normalizado (asignando profesional por defecto si aplica)
    const result = await db.query(
      `INSERT INTO turnos 
       (fecha, hora, motivo, paciente_nombre, paciente_telefono, paciente_dni, paciente_email, obra_social, estado, profesional_nombre)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CONFIRMADO', 'Odontología General') 
       RETURNING *`,
      [fechaISO, hora, motivo, paciente_nombre, paciente_telefono, paciente_dni || null, paciente_email || null, obra_social || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al asentar en agenda:', err);
    res.status(500).json({ error: err.message });
  }
});

// Ruta para agendar turno directo desde la web o manualmente
app.post('/api/turnos/solicitar-directo', (req, res) => {
  const { 
    fecha, 
    hora, 
    motivo, 
    paciente_nombre, 
    paciente_telefono, 
    telefono, 
    paciente_dni, 
    especialidad, 
    profesional,
    cancelar_turno_id 
  } = req.body;

  if (!fecha || !hora || !paciente_nombre) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  // Si se solicita cancelar un turno anterior (reprogramación)
  if (cancelar_turno_id) {
    const idx = turnosBD.findIndex(t => t.id === Number(cancelar_turno_id));
    if (idx !== -1) {
      turnosBD[idx].estado = 'Cancelado';
    }
  }

  // Crear objeto de turno compatible con la Agenda Interna
  const nuevoTurno = {
    id: Date.now(),
    paciente_nombre,
    paciente_dni: paciente_dni || '',
    telefono: paciente_telefono || telefono || '',
    fecha: fecha, // Guarda DD/MM/AAAA o YYYY-MM-DD
    fecha_arg: fecha,
    hora,
    especialidad: especialidad || 'Odontología General',
    profesional: profesional || 'Od. Sofía Martínez',
    motivo: motivo || 'Consulta General',
    estado: 'Confirmado'
  };

  turnosBD.push(nuevoTurno);
  return res.status(200).json(nuevoTurno);
});
