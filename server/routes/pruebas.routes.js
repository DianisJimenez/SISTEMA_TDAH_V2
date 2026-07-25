import { Router } from 'express';
import { pool } from '../config/db.js';
import { upload } from '../middlewares/upload.js';
import { manejarErrorServidor } from '../middlewares/manejarError.js';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM pruebas ORDER BY id DESC');
        res.status(200).json(rows);
    } catch (error) {
        manejarErrorServidor(res, error, 'GET /api/pruebas');
    }
});

router.post('/registrar', upload.single('imagen'), async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;
        const fotoUrl = req.file ? `uploads/${req.file.filename}` : null;

        const query = `INSERT INTO pruebas (nombre, descripcion, imagen_url) VALUES (?, ?, ?)`;
        const [result] = await pool.query(query, [nombre, descripcion, fotoUrl]);
        res.status(200).json({ success: true, id: result.insertId });
    } catch (error) {
        manejarErrorServidor(res, error, 'POST /api/pruebas/registrar');
    }
});

router.put('/actualizar/:id', upload.single('imagen'), async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion } = req.body;
        let query, params;

        if (req.file) {
            const fotoUrl = `uploads/${req.file.filename}`;
            query = `UPDATE pruebas SET nombre = ?, descripcion = ?, imagen_url = ? WHERE id = ?`;
            params = [nombre, descripcion, fotoUrl, id];
        } else {
            query = `UPDATE pruebas SET nombre = ?, descripcion = ? WHERE id = ?`;
            params = [nombre, descripcion, id];
        }

        await pool.query(query, params);
        res.json({ success: true, message: "Prueba actualizada" });
    } catch (error) {
        manejarErrorServidor(res, error, 'PUT /api/pruebas/actualizar/:id');
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM pruebas WHERE id = ?', [id]);
        res.json({ success: true, message: "Prueba eliminada" });
    } catch (error) {
        manejarErrorServidor(res, error, 'DELETE /api/pruebas/:id');
    }
});

export default router;
