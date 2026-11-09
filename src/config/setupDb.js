const path = require('path');
// Obligamos a leer el .env subiendo dos carpetas (desde config -> src -> raíz)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { Pool } = require('pg');

// Nos conectamos a Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const crearTablas = async () => {
  try {
    console.log('Verificando URL:', process.env.DATABASE_URL ? '✅ Encontrada' : '❌ No encontrada (Revisá tu .env)');
    if (!process.env.DATABASE_URL) return process.exit(1);
    
    console.log('Conectando a Neon para crear tablas...');

    // 1. Tabla de Usuarios (para el Login)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol VARCHAR(50) DEFAULT 'dentista'
      );
    `);

    // 2. Tabla de Pacientes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pacientes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        apellido VARCHAR(100) NOT NULL,
        dni VARCHAR(50) UNIQUE,
        telefono VARCHAR(50),
        email VARCHAR(100)
      );
    `);

    // 3. Tabla de Turnos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS turnos (
        id SERIAL PRIMARY KEY,
        paciente_id INTEGER REFERENCES pacientes(id),
        fecha DATE NOT NULL,
        hora TIME NOT NULL,
        motivo TEXT,
        estado VARCHAR(50) DEFAULT 'pendiente'
      );
    `);

    console.log('✅ ¡Éxito! Las tablas de Usuarios, Pacientes y Turnos se crearon correctamente en Neon.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear las tablas:', error);
    process.exit(1);
  }
};

crearTablas();