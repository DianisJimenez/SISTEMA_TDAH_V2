import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { upload } from '../middlewares/upload.js';
import { manejarErrorServidor } from '../middlewares/manejarError.js';
import { enviarCorreoRecuperacion } from '../config/mailer.js';

const router = Router();

router.get('/medicos', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nombre, especialidad FROM medicos ORDER BY nombre ASC');
        res.json(rows);
    } catch (error) { manejarErrorServidor(res, error, 'GET /api/medicos'); }
});

router.get('/medicos-todos', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nombre, especialidad, cedula_gen, telefono, correo, foto_ruta FROM medicos ORDER BY nombre ASC');
        res.status(200).json(rows);
    } catch (error) { manejarErrorServidor(res, error, 'GET /api/medicos-todos'); }
});

router.get('/medicos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT * FROM medicos WHERE id = ?', [id]);
        if (rows.length > 0) res.status(200).json(rows[0]);
        else res.status(404).json({ error: "Médico no encontrado" });
    } catch (error) { manejarErrorServidor(res, error, 'GET /api/medicos/:id'); }
});

router.put('/medicos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, curp, rfc, cedula_gen, cedula_esp, especialidad, telefono, correo } = req.body;
        const query = `UPDATE medicos SET nombre = ?, curp = ?, rfc = ?, cedula_gen = ?, cedula_esp = ?, especialidad = ?, telefono = ?, correo = ? WHERE id = ?`;
        await pool.query(query, [nombre, curp, rfc, cedula_gen, cedula_esp, especialidad, telefono, correo, id]);
        res.json({ success: true, message: "Médico actualizado" });
    } catch (error) { manejarErrorServidor(res, error, 'PUT /api/medicos/:id'); }
});

router.post('/registrar-medico', upload.single('foto'), async (req, res) => {
    try {
        const { nombre, fecha_nac, curp, rfc, cedula_gen, cedula_esp, especialidad, telefono, correo, password } = req.body;
        const foto_ruta = req.file ? `uploads/${req.file.filename}` : 'assets/images/doctor6.png';

        const passwordHash = await bcrypt.hash(password, 10);

        const query = `INSERT INTO medicos (nombre, fecha_nac, curp, rfc, cedula_gen, cedula_esp, especialidad, telefono, correo, foto_ruta, password, fecha_registro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
        const [result] = await pool.query(query, [nombre, fecha_nac, curp.toUpperCase(), rfc.toUpperCase(), cedula_gen, cedula_esp, especialidad, telefono, correo, foto_ruta, passwordHash]);
        res.status(200).json({ success: true, id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, error: "Ya existe un médico con ese correo, CURP o RFC." });
        }
        manejarErrorServidor(res, error, 'POST /api/registrar-medico');
    }
});

router.post('/medicos/subir-foto', upload.single('foto'), async (req, res) => {
    try {
        const { id } = req.body;
        if (!req.file) return res.status(400).json({ error: "No se seleccionó archivo" });
        const fotoUrl = `uploads/${req.file.filename}`;
        await pool.query('UPDATE medicos SET foto_ruta = ? WHERE id = ?', [fotoUrl, id]);
        res.json({ success: true, foto_url: fotoUrl });
    } catch (error) { manejarErrorServidor(res, error, 'POST /api/medicos/subir-foto'); }
});

// --- LOGIN ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT id, nombre, especialidad, foto_ruta, password FROM medicos WHERE correo = ?', [email]);
        if (rows.length === 0) return res.json({ success: false, message: "Usuario no encontrado" });
        const medico = rows[0];

        const passwordCorrecta = await bcrypt.compare(password, medico.password);

        if (passwordCorrecta) {
            // 1. Se lee el ultimo_acceso ANTES de sobreescribirlo. Ese valor
            // es la sesión anterior a esta, y es lo que se le muestra al
            // médico en su perfil (patrón "último acceso" tipo banco).
            const [prevRows] = await pool.query('SELECT ultimo_acceso FROM medicos WHERE id = ?', [medico.id]);
            const ultimoAccesoAnterior = prevRows[0].ultimo_acceso;

            // 2. Ahora sí se actualiza con el momento de este login, para
            // que quede guardado como referencia la próxima vez que entre.
            await pool.query('UPDATE medicos SET ultimo_acceso = NOW() WHERE id = ?', [medico.id]);

            res.json({
                success: true,
                medico: { id: medico.id, nombre: medico.nombre, foto: medico.foto_ruta },
                ultimoAccesoAnterior
            });
        } else {
            res.json({ success: false, message: "Contraseña incorrecta" });
        }
    } catch (error) { manejarErrorServidor(res, error, 'POST /api/login'); }
});

// --- RECUPERACIÓN DE CONTRASEÑA ---

router.post('/solicitar-recuperacion', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: "El correo es obligatorio." });
        }

        const [rows] = await pool.query('SELECT id, nombre, correo FROM medicos WHERE correo = ?', [email]);

        const mensajeGenerico = { success: true, message: "Si el correo existe, se envió un enlace de recuperación." };

        if (rows.length === 0) {
            return res.json(mensajeGenerico);
        }

        const medico = rows[0];

        const tokenOriginal = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(tokenOriginal).digest('hex');
        const expira = new Date(Date.now() + 60 * 60 * 1000);

        await pool.query(
            'UPDATE medicos SET reset_token = ?, reset_token_expira = ? WHERE id = ?',
            [tokenHash, expira, medico.id]
        );

        const link = `${process.env.APP_URL}/restablecer-password.html?token=${tokenOriginal}&id=${medico.id}`;
        await enviarCorreoRecuperacion(medico.correo, medico.nombre, link);

        res.json(mensajeGenerico);
    } catch (error) {
        manejarErrorServidor(res, error, 'POST /api/solicitar-recuperacion');
    }
});

router.post('/restablecer-password', async (req, res) => {
    try {
        const { id, token, passwordNueva } = req.body;

        if (!id || !token || !passwordNueva) {
            return res.status(400).json({ success: false, error: "Faltan datos." });
        }
        if (passwordNueva.length < 8) {
            return res.status(400).json({ success: false, error: "La contraseña debe tener al menos 8 caracteres." });
        }

        const [rows] = await pool.query(
            'SELECT reset_token, reset_token_expira FROM medicos WHERE id = ?',
            [id]
        );

        if (rows.length === 0 || !rows[0].reset_token) {
            return res.status(400).json({ success: false, error: "Link inválido o ya utilizado." });
        }

        const { reset_token, reset_token_expira } = rows[0];

        if (new Date() > new Date(reset_token_expira)) {
            return res.status(400).json({ success: false, error: "El link de recuperación expiró." });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        if (tokenHash !== reset_token) {
            return res.status(400).json({ success: false, error: "Link inválido o ya utilizado." });
        }

        const passwordHash = await bcrypt.hash(passwordNueva, 10);

        await pool.query(
            'UPDATE medicos SET password = ?, reset_token = NULL, reset_token_expira = NULL WHERE id = ?',
            [passwordHash, id]
        );

        res.json({ success: true, message: "Contraseña actualizada correctamente." });
    } catch (error) {
        manejarErrorServidor(res, error, 'POST /api/restablecer-password');
    }
});

export default router;