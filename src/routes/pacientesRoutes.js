const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const { 
  obtenerPacientes, 
  crearPaciente, 
  obtenerPacientePorId,
  obtenerArchivosPaciente,
  subirArchivoPaciente,
  eliminarArchivoPaciente,
  obtenerOdontogramaPaciente,
  guardarHallazgoOdontograma,
  eliminarHallazgoOdontograma
} = require('../controllers/pacientesController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Rutas Pacientes
router.get('/', obtenerPacientes);
router.post('/', crearPaciente);
router.get('/:id', obtenerPacientePorId);

// Rutas Archivos
router.get('/:id/archivos', obtenerArchivosPaciente);
router.post('/:id/archivos', upload.single('archivo'), subirArchivoPaciente);
router.delete('/:id/archivos/:archivoId', eliminarArchivoPaciente);

// Rutas Odontograma
router.get('/:id/odontograma', obtenerOdontogramaPaciente);
router.post('/:id/odontograma', guardarHallazgoOdontograma);
router.delete('/:id/odontograma/:hallazgoId', eliminarHallazgoOdontograma);

module.exports = router;