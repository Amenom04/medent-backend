const { Pool } = require('pg');

// Tu URL real de Neon limpia para el driver de Node.js
const urlNeon = 'postgresql://neondb_owner:npg_qskLS8ta4eRm@ep-delicate-hall-b5zwfm1m-pooler.c-7.us-east-2.aws.neon.tech/neondb';

const pool = new Pool({
  connectionString: urlNeon,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('✅ Base de datos conectada en el servidor principal');
});

pool.on('error', (err) => {
  console.error('❌ Error en la base de datos:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};