require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const registrarAdmin = async () => {
  try {
    // 1. Encriptamos la contraseña "123456" (puedes cambiarla si quieres)
    const salt = await bcrypt.genSalt(10);
    const passwordEncriptada = await bcrypt.hash('123456', salt);

    // 2. Insertamos el usuario en la tabla
    await pool.query(
      `INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4)`,
      ['Dr. Admin', 'admin@medent.com', passwordEncriptada, 'admin']
    );

    console.log('✅ ¡Usuario administrador creado con éxito!');
    console.log('Email: admin@medent.com');
    console.log('Contraseña: 123456');
    process.exit(0);
  } catch (error) {
    if (error.code === '23505') {
      console.log('⚠️ El usuario ya existe en la base de datos.');
    } else {
      console.error('❌ Error al crear usuario:', error);
    }
    process.exit(1);
  }
};

registrarAdmin();