import { Router } from 'express';
import { pool } from '../config/db.js';
import { upload } from '../middlewares/upload.js';
import { manejarErrorServidor } from '../middlewares/manejarError.js';

const router = Router();

router.get('/pacientes-todos', async (req, res) => {
    try {
        const sqlUpdate = `
            UPDATE pacientes p
            SET p.estado = CASE 
                WHEN EXISTS (SELECT 1 FROM sesiones_paciente s WHERE s.paciente_id = p.id) 
                THEN 'En Sesión' 
                ELSE 'Sin Sesión' 
            END`;
        await pool.query(sqlUpdate);

       
        const query = 'SELECT id, nombre, edad, sexo, estado, fecha_registro, foto_url, dispositivo_id FROM pacientes ORDER BY id DESC';
        const [rows] = await pool.query(query);
        res.status(200).json(rows);
    } catch (error) { manejarErrorServidor(res, error, 'GET /api/pacientes-todos'); }
});

router.get('/pacientes/medico/:medicoId', async (req, res) => {
    try {
        const { medicoId } = req.params;

        const sqlUpdate = `
            UPDATE pacientes p
            SET p.estado = CASE 
                WHEN EXISTS (SELECT 1 FROM sesiones_paciente s WHERE s.paciente_id = p.id) 
                THEN 'En Sesión' 
                ELSE 'Sin Sesión' 
            END
            WHERE p.medico_id = ?`;

        await pool.query(sqlUpdate, [medicoId]);

        // Se agrega 'diagnostico' (columna de Pronóstico en la tabla de pacientes
        const sqlSelect = `
            SELECT 
                p.id, p.nombre, p.edad, p.sexo, p.estado, p.foto_url, p.dispositivo_id,
                (SELECT s.diagnostico FROM sesiones_paciente s 
                 WHERE s.paciente_id = p.id 
                 ORDER BY s.fecha_hora DESC LIMIT 1) AS diagnostico
            FROM pacientes p
            WHERE p.medico_id = ? 
            ORDER BY p.id DESC`;

        const [rows] = await pool.query(sqlSelect, [medicoId]);
        res.status(200).json(rows);

    } catch (error) {
        manejarErrorServidor(res, error, 'GET /api/pacientes/medico/:medicoId');
    }
});

router.get('/pacientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT * FROM pacientes WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Paciente no encontrado" });

        const [pruebasRows] = await pool.query(
            'SELECT prueba_id FROM paciente_prueba WHERE paciente_id = ?',
            [id]
        );
        const paciente = rows[0];
        paciente.pruebas_ids = pruebasRows.map(r => r.prueba_id);

        res.status(200).json(paciente);
    } catch (error) { manejarErrorServidor(res, error, 'GET /api/pacientes/:id'); }
});

router.post('/registrar-paciente', async (req, res) => {
    try {
        const { nombre, edad, sexo, curp, telefono, fecha_nacimiento, tipo_sangre, medico_id, dispositivo_id } = req.body;

        // Validaciones mínimas del lado del servidor
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ success: false, error: "El nombre es obligatorio." });
        }
        if (!fecha_nacimiento) {
            return res.status(400).json({ success: false, error: "La fecha de nacimiento es obligatoria." });
        }

        const fechaNac = new Date(fecha_nacimiento);
        if (isNaN(fechaNac.getTime())) {
            return res.status(400).json({ success: false, error: "La fecha de nacimiento no es válida." });
        }
        if (fechaNac > new Date()) {
            return res.status(400).json({ success: false, error: "La fecha de nacimiento no puede ser futura." });
        }

        if (curp && !/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(curp.toUpperCase())) {
            return res.status(400).json({ success: false, error: "La CURP no tiene un formato válido." });
        }
        if (telefono && !/^\d{10}$/.test(telefono)) {
            return res.status(400).json({ success: false, error: "El teléfono debe tener exactamente 10 dígitos." });
        }
        const edadNum = parseInt(edad);
        if (isNaN(edadNum) || edadNum < 0 || edadNum > 120) {
            return res.status(400).json({ success: false, error: "La edad no es válida." });
        }

        // Si viene vacía, se guarda como NULL: así MySQL no la choca contra el índice UNIQUE
        const curpFinal = curp && curp.trim() ? curp.trim().toUpperCase() : null;

        const query = `INSERT INTO pacientes (nombre, edad, sexo, estado, fecha_registro, telefono, curp, fecha_nacimiento, tipo_sangre, medico_id, dispositivo_id) VALUES (?, ?, ?, 'Sin sesión', NOW(), ?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(query, [nombre, edadNum, sexo, telefono, curpFinal, fecha_nacimiento, tipo_sangre, medico_id, dispositivo_id || null]);
        res.status(200).json({ success: true, id: result.insertId });
    } catch (error) {
        // uq_pacientes_curp: ya existe un paciente con esa CURP
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, error: "Ya existe un paciente registrado con esa CURP." });
        }
        // fk_pacientes_medico / fk_pacientes_dispositivo: el id referenciado no existe
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ success: false, error: "El médico o dispositivo especificado no existe." });
        }
        manejarErrorServidor(res, error, 'POST /api/registrar-paciente');
    }
});

router.put('/pacientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, edad, sexo, curp, telefono, fecha_nacimiento, tipo_sangre, notas, medico_id, dispositivo_id } = req.body;

        if (fecha_nacimiento) {
            const fechaNac = new Date(fecha_nacimiento);
            if (isNaN(fechaNac.getTime())) {
                return res.status(400).json({ success: false, error: "La fecha de nacimiento no es válida." });
            }
            if (fechaNac > new Date()) {
                return res.status(400).json({ success: false, error: "La fecha de nacimiento no puede ser futura." });
            }
        }
        if (edad !== undefined && edad !== null && edad !== '') {
            const edadNum = parseInt(edad, 10);
            if (isNaN(edadNum) || edadNum < 0 || edadNum > 120) {
                return res.status(400).json({ success: false, error: "La edad no es válida." });
            }
        }

        const curpFinal = curp && curp.trim() ? curp.trim().toUpperCase() : null;

        const query = `UPDATE pacientes SET nombre = ?, edad = ?, sexo = ?, curp = ?, telefono = ?, fecha_nacimiento = ?, tipo_sangre = ?, notas = COALESCE(?, notas), medico_id = ?, dispositivo_id = ? WHERE id = ?`;
        await pool.query(query, [nombre, edad, sexo, curpFinal, telefono, fecha_nacimiento, tipo_sangre, notas, medico_id || null, dispositivo_id || null, id]);
        res.json({ success: true, message: "Datos actualizados" });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, error: "Ya existe un paciente registrado con esa CURP." });
        }
        manejarErrorServidor(res, error, 'PUT /api/pacientes/:id');
    }
});

router.post('/pacientes/subir-foto', upload.single('foto'), async (req, res) => {
    try {
        const { id } = req.body;
        if (!req.file) return res.status(400).json({ error: "No se seleccionó archivo" });
        const fotoUrl = `uploads/${req.file.filename}`;
        await pool.query('UPDATE pacientes SET foto_url = ? WHERE id = ?', [fotoUrl, id]);
        res.json({ success: true, foto_url: fotoUrl });
    } catch (error) { manejarErrorServidor(res, error, 'POST /api/pacientes/subir-foto'); }
});

router.delete('/pacientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM pacientes WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) { manejarErrorServidor(res, error, 'DELETE /api/pacientes/:id'); }
});

router.put('/pacientes/:id/asignar-pruebas', async (req, res) => {
    const { id } = req.params;
    const { prueba_id } = req.body;

    let idsPruebas = [];
    if (Array.isArray(prueba_id)) {
        idsPruebas = prueba_id.map(Number).filter(n => !isNaN(n));
    } else if (typeof prueba_id === 'string' && prueba_id.trim() !== '') {
        idsPruebas = prueba_id.split(',').map(v => parseInt(v.trim(), 10)).filter(n => !isNaN(n));
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query('DELETE FROM paciente_prueba WHERE paciente_id = ?', [id]);

        if (idsPruebas.length > 0) {
            const valores = idsPruebas.map(pruebaId => [id, pruebaId]);
            await connection.query('INSERT INTO paciente_prueba (paciente_id, prueba_id) VALUES ?', [valores]);
        }

        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        manejarErrorServidor(res, error, 'PUT /api/pacientes/:id/asignar-pruebas');
    } finally {
        connection.release();
    }
});

router.get('/stats', async (req, res) => {
    try {
        const [[{total}]] = await pool.query('SELECT COUNT(*) as total FROM pacientes');
        const [[{sinSesion}]] = await pool.query("SELECT COUNT(*) as sinSesion FROM pacientes WHERE estado = 'Sin sesión'");
        res.json({ total, sinSesion, pendientes: sinSesion });
    } catch (error) { manejarErrorServidor(res, error, 'GET /api/stats'); }
});

router.get('/stats/medico/:medicoId', async (req, res) => {
    try {
        const { medicoId } = req.params;
        const [[{total}]] = await pool.query('SELECT COUNT(*) as total FROM pacientes WHERE medico_id = ?', [medicoId]);
        const [[{sinSesion}]] = await pool.query("SELECT COUNT(*) as sinSesion FROM pacientes WHERE estado = 'Sin sesión' AND medico_id = ?", [medicoId]);
        res.json({ total, sinSesion, pendientes: sinSesion });
    } catch (error) { manejarErrorServidor(res, error, 'GET /api/stats/medico/:medicoId'); }
});

export default router;