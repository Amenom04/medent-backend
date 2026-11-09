// POST /api/turnos/reservar-publico
router.post('/reservar-publico', async (req, res) => {
  const { fecha, hora, profesionalId, paciente, motivo } = req.body;

  try {
    // 1. Verificar si ya existe un turno asentado para esa fecha y hora exactas
    const turnoExistente = await db.query(
      'SELECT id FROM turnos WHERE fecha = $1 AND hora = $2 AND estado != $3',
      [fecha, hora, 'CANCELADO']
    );

    if (turnoExistente.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: '⚠️ El horario seleccionado acaba de ser reservado por otro paciente. Por favor selecciona otro horario.'
      });
    }

    // 2. Insertar y asentar el turno en la agenda automáticamente
    const nuevoTurno = await db.query(
      `INSERT INTO turnos (codigo, fecha, hora, paciente_nombre, paciente_dni, paciente_telefono, paciente_email, motivo, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        'MED-' + Math.floor(100000 + Math.random() * 900000),
        fecha,
        hora,
        paciente.nombre,
        paciente.dni,
        paciente.telefono,
        paciente.email,
        motivo,
        'CONFIRMADO'
      ]
    );

    res.status(201).json({
      success: true,
      turno: nuevoTurno.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error interno al reservar el turno' });
  }
});

// backend/routes/turnos.js

router.post('/reservar-publico', async (req, res) => {
  const { fecha, hora, motivo, paciente } = req.body;

  try {
    // 1. Guardar turno en la base de datos PostgreSQL
    const nuevoTurno = await db.query(
      `INSERT INTO turnos (codigo, fecha, hora, paciente_nombre, paciente_telefono, paciente_dni, paciente_email, obra_social, motivo, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        'MED-' + Math.floor(100000 + Math.random() * 900000),
        fecha,
        hora,
        paciente.nombre,
        paciente.telefono,
        paciente.dni || null,
        paciente.email || null,
        paciente.obraSocial || null,
        motivo,
        'CONFIRMADO'
      ]
    );

    const turno = nuevoTurno.rows[0];

    // 📩 MENSAJE 1: Confirmación Inmediata al reservar
    await enviarWhatsAppAutomatsico({
      telefono: paciente.telefono,
      mensaje: `¡Hola ${paciente.nombre}! 👋 Tu turno en MeDent ha sido asentado con éxito para el ${fecha} a las ${hora} hs. Código de cita: ${turno.codigo}.`
    });

    // 📩 MENSAJE 2: Programar Recordatorio 24 horas antes
    // Incluye opciones interactivas: 1. Confirmar, 2. Cancelar, 3. Reprogramar
    await programarRecordatorio24hs({
      turnoId: turno.id,
      telefono: paciente.telefono,
      fecha: fecha,
      hora: hora,
      mensaje: `Hola ${paciente.nombre}, te recordamos tu turno en MeDent para mañana ${fecha} a las ${hora} hs.\n\nPor favor responde:\n1️⃣ Para Confirmar\n2️⃣ Para Cancelar\n3️⃣ Para Reprogramar`
    });

    // 📩 MENSAJE 3: Programar Recordatorio Anual de Control
    await programarRecordatorioAnual({
      pacienteId: paciente.dni || turno.id,
      telefono: paciente.telefono,
      mensaje: `Hola ${paciente.nombre}, ha pasado 1 año desde tu última revisión odontológica. Te sugerimos agendar una consulta de rutina para mantener tu salud bucal al día.`
    });

    res.status(201).json({ success: true, turno });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al reservar el turno' });
  }
});

// Obtener franjas horarias ocupadas para la fecha solicitada
app.get('/api/turnos/ocupados', async (req, res) => {
  const { fecha } = req.query;
  try {
    const result = await db.query(
      `SELECT hora FROM turnos WHERE fecha = $1 AND estado != 'CANCELADO'`,
      [fecha]
    );
    const ocupados = result.rows.map(row => row.hora);
    res.json({ ocupados });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint de reserva con validación anticolisión
app.post('/api/turnos/solicitar-directo', async (req, res) => {
  const { fecha, hora, motivo, paciente_nombre, paciente_telefono, paciente_dni, paciente_email, obra_social } = req.body;

  try {
    // 1. VALIDACIÓN ANTICOLISIÓN: Verificar si el turno ya fue tomado
    const conflicto = await db.query(
      `SELECT id FROM turnos WHERE fecha = $1 AND hora = $2 AND estado != 'CANCELADO'`,
      [fecha, hora]
    );

    if (conflicto.rows.length > 0) {
      return res.status(409).json({ 
        error: '⚠️ El horario seleccionado ya no está disponible. Por favor elige otro.' 
      });
    }

    // 2. Insertar turno directo en la base de datos de la agenda
    const codigo = 'MED-' + Math.floor(100000 + Math.random() * 900000);
    const nuevoTurno = await db.query(
      `INSERT INTO turnos (codigo, fecha, hora, motivo, paciente_nombre, paciente_telefono, paciente_dni, paciente_email, obra_social, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'CONFIRMADO') RETURNING *`,
      [codigo, fecha, hora, motivo, paciente_nombre, paciente_telefono, paciente_dni, paciente_email, obra_social]
    );

    res.status(201).json(nuevoTurno.rows[0]);
  } catch (err) {
    console.error('Error al agendar turno:', err.message);
    res.status(500).json({ error: err.message });
  }
});

