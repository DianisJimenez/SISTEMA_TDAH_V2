import { Router } from 'express';
import { pool } from '../config/db.js';
import { manejarErrorServidor } from '../middlewares/manejarError.js';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const queryLinea = `
            SELECT DATE_FORMAT(fecha_registro, '%Y-%m-%d') as dia, COUNT(*) as total 
            FROM pacientes 
            GROUP BY dia 
            ORDER BY dia ASC 
            LIMIT 30`;

        const queryDona = `
            SELECT diagnostico, COUNT(*) as cantidad
            FROM (
                SELECT p.id AS paciente_id,
                    COALESCE(
                        (SELECT s.diagnostico FROM sesiones_paciente s 
                         WHERE s.paciente_id = p.id 
                         ORDER BY s.fecha_hora DESC LIMIT 1),
                        'Sin diagnóstico'
                    ) AS diagnostico
                FROM pacientes p
            ) ultimo_diagnostico_por_paciente
            GROUP BY diagnostico`;

        const [resultadosLinea] = await pool.query(queryLinea);
        const [resultadosDona] = await pool.query(queryDona);

        res.json({
            linea: resultadosLinea,
            dona: resultadosDona
        });
    } catch (error) {
        manejarErrorServidor(res, error, 'GET /api/stats-admin');
    }
});

router.get('/medico/:medicoId', async (req, res) => {
    try {
        const { medicoId } = req.params;

        const queryLinea = `
            SELECT DATE_FORMAT(fecha_registro, '%Y-%m-%d') as dia, COUNT(*) as total 
            FROM pacientes 
            WHERE medico_id = ?
            GROUP BY dia 
            ORDER BY dia ASC 
            LIMIT 30`;

        const queryDona = `
            SELECT diagnostico, COUNT(*) as cantidad
            FROM (
                SELECT p.id AS paciente_id,
                    COALESCE(
                        (SELECT s.diagnostico FROM sesiones_paciente s 
                         WHERE s.paciente_id = p.id 
                         ORDER BY s.fecha_hora DESC LIMIT 1),
                        'Sin diagnóstico'
                    ) AS diagnostico
                FROM pacientes p
                WHERE p.medico_id = ?
            ) ultimo_diagnostico_por_paciente
            GROUP BY diagnostico`;

        const [resultadosLinea] = await pool.query(queryLinea, [medicoId]);
        const [resultadosDona] = await pool.query(queryDona, [medicoId]);

        res.json({
            linea: resultadosLinea,
            dona: resultadosDona
        });
    } catch (error) {
        manejarErrorServidor(res, error, 'GET /api/stats-admin/medico/:medicoId');
    }
});

export default router;
