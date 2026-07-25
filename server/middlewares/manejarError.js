// Helper para no filtrar error.message crudo al cliente.
// Loguea el detalle completo en el server y responde algo genérico.
export function manejarErrorServidor(res, error, contexto) {
    console.error(`❌ Error en ${contexto}:`, error);
    res.status(500).json({ success: false, error: 'Ocurrió un error interno. Intenta de nuevo más tarde.' });
}
