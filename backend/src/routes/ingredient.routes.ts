/**
 * ====================================================
 * RUTAS DE INSUMOS E INVENTARIO (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP a las acciones de IngredientController.
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ingredientController } from '../controllers/ingredient.controller';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
// busboy corta cuando el archivo ALCANZA el límite; el +1 hace que uno de exactamente 10 MB sí se acepte
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES + 1 } });

// Convierte los errores de multer en respuestas 400 con mensaje claro
// (si no, llegan al manejador global y el cliente recibe un 500)
const uploadSingleFile = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'El archivo supera el tamaño máximo de 10 MB'
      : 'No se pudo leer el archivo adjunto';
    return res.status(400).json({ error: message });
  });
};

const router = Router();

// Endpoint GET: Listar todo el inventario de materias primas
router.get('/', (req, res) => ingredientController.getIngredients(req, res));

// Endpoint GET: Descargar plantilla de Excel para carga masiva de insumos
router.get('/template/ingredients', (req, res) => ingredientController.downloadTemplate(req, res));

// Endpoint GET: Descargar reporte de inventarios de insumos en formato Excel
router.get('/export/ingredients', (req, res) => ingredientController.exportExcel(req, res));

// Endpoint POST: Carga masiva de insumos desde archivo Excel
router.post('/import/ingredients', uploadSingleFile, (req, res) => ingredientController.importExcel(req, res));

// Endpoint GET: Consultar un insumo y su historial de movimientos
router.get('/:id', (req, res) => ingredientController.getIngredientById(req, res));

// Endpoint POST: Registrar un insumo nuevo en el sistema
router.post('/', (req, res) => ingredientController.createIngredient(req, res));

// Endpoint PUT: Actualizar datos de insumo o realizar ajustes de stock
router.put('/:id', (req, res) => ingredientController.updateIngredient(req, res));

// Endpoint DELETE: Eliminar un insumo
router.delete('/:id', (req, res) => ingredientController.deleteIngredient(req, res));

export default router;
