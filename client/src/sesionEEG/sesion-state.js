// Estado de grabación, compartido entre dispositivo-conexion.js y control-sesion.js
export const sesionState = {
    recording: false,
    currentMarker: "none",        // marca la fila de CSV actual (start/end de prueba)
    idSesionActual: null,         // id real que regresa la BD al iniciar sesión
    csvRows: [],
    listaDePruebasRealizadas: [],
    historialEvolucionBandas: [], // puntos de la gráfica de bandas de toda la sesión
    huboInterrupcionConexion: false,
};
