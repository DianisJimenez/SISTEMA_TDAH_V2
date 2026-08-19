// Estado de grabación, compartido entre dispositivo-conexion.js y control-sesion.js
export const sesionState = {
    recording: false,
    currentMarker: "none",        // marca la fila de CSV actual (start/end de prueba)
    idSesionActual: null,         // id real que regresa la BD al iniciar sesión
    csvRows: [],
    listaDePruebasRealizadas: [],
    historialEvolucionBandas: [], // puntos de la gráfica de bandas de toda la sesión
    huboInterrupcionConexion: false,
    pruebasInterrumpidas: [],     // pruebas que se cortaron por pérdida de señal
    // función para cerrar una prueba en curso, evita import circular entre los dos módulos
    interrumpirPruebaActual: null,
    // marca una interrupción de señal cuando no hay prueba activa que cerrar
    marcarInterrupcionSenal: null,
    // marcador libre en el CSV sin cerrar la prueba activa, usado en reconexión automática
    agregarMarcadorLibre: null,
};