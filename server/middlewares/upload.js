import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Ruta absoluta, ya no depende de desde dónde se ejecute "node server.js"
const uploadsDir = path.join(__dirname, '../uploads');

// --- Subida de imágenes (fotos de pacientes, médicos, dispositivos, pruebas) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `archivo_${Date.now()}${ext}`);
    }
});

export const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('El archivo debe ser una imagen (jpg, png, gif)'));
        }
    }
});

// --- Subida de CSV (datos crudos de sesión EEG) ---
const storageCSV = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const idSesion = req.body.idSesion || 'sinID';
        // Nombre único por archivo (fieldname + timestamp + random): evita que el CSV
        // de sesión y los 4 de pruebas se pisen entre sí al compartir el mismo idSesion.
        const sufijoUnico = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
        cb(null, `EEG_${file.fieldname}_sesion_${idSesion}_${sufijoUnico}.csv`);
    }
});

export const uploadCSV = multer({
    storage: storageCSV,
    fileFilter: (req, file, cb) => {
        const extOk = path.extname(file.originalname).toLowerCase() === '.csv';
        const mimeOk = file.mimetype === 'text/csv' ||
                       file.mimetype === 'application/vnd.ms-excel' ||
                       file.mimetype === 'application/octet-stream';
        if (extOk && mimeOk) {
            cb(null, true);
        } else {
            cb(new Error('El archivo debe ser un CSV (.csv)'));
        }
    }
});