const express = require('express');
const router = express.Router();
const { obtenerTratamientos, crearTratamiento } = require('../controllers/tratamientosController');

router.get('/', obtenerTratamientos);
router.post('/', crearTratamiento);

module.exports = router;