import { Router } from 'express';
import { pool } from '../config/db.js';
import { upload } from '../middlewares/upload.js';
import { manejarErrorServidor } from '../middlewares/manejarError.js';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM dispositivos ORDER BY id DESC');
        res.status(200).json(rows);
    } catch (error) {
        manejarErrorServidor(res, error, 'GET /api/dispositivos');
    }
});

router.post('/registrar', upload.single('foto'), async (req, res) => {
    try {
        const { nombre, conexion, descripcion } = req.body;
        const fotoUrl = req.file ? `uploads/${req.file.filename}` : 'assets/images/default-device.png';
        const query = `INSERT INTO dispositivos (nombre, conexion, descripcion, foto_url) VALUES (?, ?, ?, ?)`;
        const [result] = await pool.query(query, [nombre, conexion, descripcion, fotoUrl]);
        res.status(200).json({ success: true, id: result.insertId });
    } catch (error) {
        manejarErrorServidor(res, error, 'POST /api/dispositivos/registrar');
    }
});

router.put('/:id', upload.single('foto'), async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, conexion, descripcion } = req.body;
        let query, params;

        if (req.file) {
            const fotoUrl = `uploads/${req.file.filename}`;
            query = `UPDATE dispositivos SET nombre = ?, conexion = ?, descripcion = ?, foto_url = ? WHERE id = ?`;
            params = [nombre, conexion, descripcion, fotoUrl, id];
        } else {
            query = `UPDATE dispositivos SET nombre = ?, conexion = ?, descripcion = ? WHERE id = ?`;
            params = [nombre, conexion, descripcion, id];
        }

        await pool.query(query, params);
        res.json({ success: true, message: "Dispositivo actualizado" });
    } catch (error) {
        manejarErrorServidor(res, error, 'PUT /api/dispositivos/:id');
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'DELETE FROM dispositivos WHERE id = ?';
        await pool.query(query, [id]);
        res.json({ success: true, message: "Dispositivo eliminado correctamente" });
    } catch (error) {
        manejarErrorServidor(res, error, 'DELETE /api/dispositivos/:id');
    }
});

export default router;
