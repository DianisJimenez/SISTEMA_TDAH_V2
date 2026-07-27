// Estado compartido entre los módulos de la sesión EEG

// URL base del backend (tomada del origen actual, funciona en cualquier host)
export const API_BASE = window.location.origin;

// IDs que llegan por la URL de la página (paciente y dispositivo)
const urlParams = new URLSearchParams(window.location.search);
export const idPacienteURL = urlParams.get('id');
export const idMuseURL = urlParams.get('dev');
export const idSesionResumirURL = urlParams.get('sesion'); // si viene, se está reanudando una sesión incompleta en vez de crear una nueva

// Valores en vivo que escribe dispositivo-conexion.js y lee visual3d-graficas.js
export const liveState = {
    accelX: 0, accelY: 0, accelZ: 0,
    gyroX: 0, gyroY: 0, gyroZ: 0,
    chartStartTime: 0,   // momento en que se conecta el dispositivo
    sessionStartTime: 0, // momento en que se presiona "iniciar sesión"
};