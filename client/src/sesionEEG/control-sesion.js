import { API_BASE, idPacienteURL, idMuseURL, idSesionResumirURL, liveState } from './state.js';
import { sesionState } from './sesion-state.js';
import { showStatusMessage } from './ui.js';
import { resetearFiltros, promediarBandasEnRango } from './filtros-bandas.js';
import { resetChartData, dibujarMarcador, limpiarMarcadoresSesion } from './visual3d-graficas.js';
import { cargarCatalogoPruebas } from './paciente-api.js';
import { detenerAdquisicion } from './dispositivo-conexion.js';

let recordingStartTime;
let timerInterval;

let pruebaActiva = "NINGUNA"; // nombre de la prueba corriendo ahora, o NINGUNA
let isPaused = false; // true mientras la prueba activa está en pausa
let pruebaStartTime = 0; // timestamp en que arrancó la prueba activa
let tiempoPausadoAcumulado = 0; // ms acumulados en pausa, se resta al final
let pausaInicioTimestamp = 0; // timestamp de cuándo empezó la pausa actual

// Actualiza el reloj visual de la grabación cada segundo
function updateTimer() {
    if (!sesionState.recording) return;
    const now = Date.now();
    const diff = now - recordingStartTime;
    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    document.getElementById("recordingTimer").innerText =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Botón "Iniciar sesión" crea la sesión en la BD y arranca la grabación global
document.getElementById("startRecording").onclick = async () => {
    if (sesionState.recording) return;

    if (idSesionResumirURL) {
        // caso: se está reanudando una sesión existente, no hay que crear una nueva en BD
        sesionState.idSesionActual = idSesionResumirURL;
        const elCodigoSesion = document.getElementById('sesion-codigo');
        if (elCodigoSesion) elCodigoSesion.innerText = `SES-${sesionState.idSesionActual} (reanudada)`;
    } else {
    // Crea la sesión en la BD para tener el id_sesion real
    try {
        const resSesion = await fetch(`${API_BASE}/api/iniciar-sesion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pacienteId: idPacienteURL,
                dispositivoId: idMuseURL,
                nombrePaciente: document.getElementById("sesion-nombre").innerText
            })
        });
        const dataSesion = await resSesion.json();
        if (dataSesion.success) {
            sesionState.idSesionActual = dataSesion.idSesion;
            const elCodigoSesion = document.getElementById('sesion-codigo');
            if (elCodigoSesion) elCodigoSesion.innerText = `SES-${sesionState.idSesionActual}`;
        } else {
            showStatusMessage("No se pudo generar el código de sesión", "#ffa500");
        }
    } catch (e) {
        console.error("Error creando la sesión en BBDD:", e);
        showStatusMessage("No se pudo conectar con el servidor para iniciar sesión", "#e74c3c");
    }
    }

    sesionState.recording = true; // bandera global: hay una grabación en curso

    const elRingWrap = document.getElementById('timerRingWrap');
    if (elRingWrap) elRingWrap.classList.add('is-recording');
    const elStatusLabel = document.getElementById('recordingStatusLabel');
    if (elStatusLabel) elStatusLabel.innerText = 'Grabando…';

    // Reinicia todo el historial de la sesión anterior
    liveState.sessionStartTime = Date.now();
    // El reloj de la gráfica se resincroniza con el de la sesión real para que el segundo 0 de ambos coincida
    liveState.chartStartTime = liveState.sessionStartTime;
    sesionState.listaDePruebasRealizadas = [];
    sesionState.historialEvolucionBandas = [];
    sesionState.huboInterrupcionConexion = false;
    resetearFiltros();
    const elPruebasReset1 = document.getElementById("sesion-pruebas-realizadas");
    if (elPruebasReset1) elPruebasReset1.innerText = "0";
    resetChartData(); // limpia la gráfica y arranca justo en el segundo 0 real
    limpiarMarcadoresSesion();

    recordingStartTime = Date.now();
    sesionState.csvRows = []; // buffer del CSV completo de la sesión, en memoria
    // Cabecera del CSV, 29 columnas
    sesionState.csvRows.push("timestamp,tp9,af7,af8,tp10,theta,alpha,beta,theta_tp9,alpha_tp9,beta_tp9,theta_af7,alpha_af7,beta_af7,theta_af8,alpha_af8,beta_af8,theta_tp10,alpha_tp10,beta_tp10,banda_actualizada,accelX,accelY,accelZ,gyroX,gyroY,gyroZ,artefacto,marker");

    timerInterval = setInterval(updateTimer, 1000);
    cargarCatalogoPruebas();

    document.getElementById("startRecording").style.display = "none";
    document.getElementById("trialSelectorArea").style.display = "block";
    document.getElementById("stopRecording").style.display = "block";
    document.getElementById("downloadCSV").style.display = "none";

    showStatusMessage(" Grabación Global Iniciada", "#2ecc71");
};

// Botón "Iniciar prueba"
document.getElementById("startTrial").onclick = () => {
    const selector = document.getElementById("pruebaCatalogo");
    if (!selector.value) {
        return showStatusMessage(" Seleccione una prueba", "#ffa500");
    }
    pruebaActiva = selector.value;
    sesionState.currentMarker = `${pruebaActiva}_START`; // marcador que quedará pegado a la próxima lectura del CSV
    dibujarMarcador(`start_${pruebaActiva}`, `INICIO: ${pruebaActiva}`, '#8e44ad');

    pruebaStartTime = Date.now();
    tiempoPausadoAcumulado = 0;
    isPaused = false;

    document.getElementById("trialSelectorArea").style.display = "none";
    document.getElementById("stopTrial").style.display = "block";
    document.getElementById("pauseTrial").style.display = "block";
    document.getElementById("stopTrial").innerText = `TERMINAR: ${pruebaActiva}`;

    showStatusMessage(`Ejecutando: ${pruebaActiva}`, "#8e44ad");
};

// Botón "Pausar/Reanudar prueba"
document.getElementById("pauseTrial").onclick = () => {
    isPaused = !isPaused;

    const btnTerminarPrueba = document.getElementById("stopTrial");
    const btnFinalizarSesion = document.getElementById("stopRecording");

    if (isPaused) {
        pausaInicioTimestamp = Date.now();

        document.getElementById("pauseTrial").innerText = "REANUDAR PRUEBA";
        document.getElementById("pauseTrial").style.backgroundColor = "#2ecc71";

        // Bloquea terminar prueba / finalizar sesión mientras está en pausa
        btnTerminarPrueba.disabled = true;
        btnFinalizarSesion.disabled = true;
        btnTerminarPrueba.style.opacity = "0.5";
        btnFinalizarSesion.style.opacity = "0.5";
        btnTerminarPrueba.style.cursor = "not-allowed";
        btnFinalizarSesion.style.cursor = "not-allowed";

        showStatusMessage("Prueba en pausa: Reanuda para poder finalizar", "#ff9800");
    } else {
        const duracionDeEstaPausa = Date.now() - pausaInicioTimestamp;
        tiempoPausadoAcumulado += duracionDeEstaPausa; // se descuenta del tiempo neto al finalizar

        document.getElementById("pauseTrial").innerText = "PAUSAR PRUEBA";
        document.getElementById("pauseTrial").style.backgroundColor = "#ff9800";

        btnTerminarPrueba.disabled = false;
        btnFinalizarSesion.disabled = false;
        btnTerminarPrueba.style.opacity = "1";
        btnFinalizarSesion.style.opacity = "1";
        btnTerminarPrueba.style.cursor = "pointer";
        btnFinalizarSesion.style.cursor = "pointer";

        showStatusMessage("Prueba reanudada", "#2ecc71");
    }
};

// Fila de marcador sin lectura real del Muse, para no perder el marcador si nunca llega otra fila
function agregarFilaMarcador(marcador) {
    const fila = [
        Date.now(),
        "", "", "", "",                          // tp9, af7, af8, tp10
        "", "", "",                               // theta, alpha, beta (promedio)
        "", "", "", "", "", "", "", "", "", "", "", "", // theta/alpha/beta por canal (tp9, af7, af8, tp10)
        0,                                          // banda_actualizada
        "", "", "",                                // accelX, accelY, accelZ
        "", "", "",                                // gyroX, gyroY, gyroZ
        0,                                          // artefacto
        marcador
    ].join(",");
    sesionState.csvRows.push(fila);
}

// Cierra la prueba activa, ya sea de forma normal o forzada por pérdida de señal. Devuelve false si no había ninguna prueba activa
function finalizarPruebaActual({ interrumpida = false } = {}) {
    if (pruebaActiva === "NINGUNA") return false;

    const nombrePrueba = pruebaActiva;
    const pruebaEndTime = Date.now();
    const duracionTotal = pruebaEndTime - pruebaStartTime;
    const duracionEfectivaMs = duracionTotal - tiempoPausadoAcumulado; // resta el tiempo en pausa
    const segundosNetos = (duracionEfectivaMs / 1000).toFixed(2);

    if (interrumpida) {
        // Cierre forzado por pérdida de señal: NO se agrega a listaDePruebasRealizadas, queda pendiente para reanudar
        dibujarMarcador(`interrumpida_${nombrePrueba}`, `SEÑAL PERDIDA: ${nombrePrueba}`, '#e74c3c');
        agregarFilaMarcador(`${nombrePrueba}_INTERRUMPIDA_${segundosNetos}s`);
        sesionState.pruebasInterrumpidas.push({ nombre: nombrePrueba, segundosGrabados: segundosNetos });
        showStatusMessage(
            `"${nombrePrueba}" Se cortó por pérdida de señal (${segundosNetos}s grabados). Quedó pendiente para reanudar.`,
            "#e74c3c"
        );
    } else {
        dibujarMarcador(`end_${nombrePrueba}`, `FIN: ${nombrePrueba}`, '#2ecc71');

        const inicioRelSeg = (pruebaStartTime - liveState.sessionStartTime) / 1000;
        const finRelSeg = (pruebaEndTime - liveState.sessionStartTime) / 1000;

        // Promedio de bandas SOLO del tramo de esta prueba, no de toda la sesión
        const bandasDeLaPrueba = promediarBandasEnRango(sesionState.historialEvolucionBandas, inicioRelSeg, finRelSeg);

        const marcador = {
            nombre: nombrePrueba,
            inicioRelativo: inicioRelSeg.toFixed(2),
            duracionNeto: segundosNetos,
            avgTheta: bandasDeLaPrueba.avgTheta.toFixed(2),
            avgAlpha: bandasDeLaPrueba.avgAlpha.toFixed(2),
            avgBeta: bandasDeLaPrueba.avgBeta.toFixed(2)
        };
        sesionState.listaDePruebasRealizadas.push(marcador);
        console.log("Prueba registrada para el historial:", marcador);

        const elPruebasRealizadas = document.getElementById('sesion-pruebas-realizadas');
        if (elPruebasRealizadas) elPruebasRealizadas.innerText = sesionState.listaDePruebasRealizadas.length;

        sesionState.currentMarker = `${nombrePrueba}_END_DUR_${segundosNetos}s`;
    }

    document.getElementById("stopTrial").style.display = "none";
    document.getElementById("pauseTrial").style.display = "none";

    // Quita la prueba del selector solo si se completó normalmente; si se interrumpió, se deja para reintentar
    const selector = document.getElementById("pruebaCatalogo");
    if (!interrumpida) {
        for (let i = 0; i < selector.options.length; i++) {
            if (selector.options[i].value === nombrePrueba) {
                selector.remove(i);
                break;
            }
        }
    }

    if (selector.options.length > 1 || interrumpida) {
        if (!interrumpida) showStatusMessage(`"${nombrePrueba}" finalizada: ${segundosNetos}s netos.`, "#2ecc71");
        document.getElementById("trialSelectorArea").style.display = "block";
        selector.value = "";
    } else {
        // Ya no quedan pruebas pendientes, invita a finalizar sesión
        document.getElementById("trialSelectorArea").style.display = "none";
        showStatusMessage(`Todas las pruebas listas (${segundosNetos}s la última). Finalice sesión.`, "#2c3e50");
        document.getElementById("stopRecording").classList.add("btn-pulse");
    }

    pruebaActiva = "NINGUNA";
    isPaused = false;
    tiempoPausadoAcumulado = 0;

    // Libera botones por si el cierre forzado ocurrió mientras la prueba estaba en pausa
    document.getElementById("pauseTrial").innerText = "PAUSAR PRUEBA";
    document.getElementById("pauseTrial").style.backgroundColor = "#ff9800";
    document.getElementById("stopRecording").disabled = false;
    document.getElementById("stopRecording").style.opacity = "1";
    document.getElementById("stopRecording").style.cursor = "pointer";

    return true;
}

// Botón "Terminar prueba"
document.getElementById("stopTrial").onclick = () => {
    if (isPaused) {
        showStatusMessage("Reanuda la prueba antes de terminarla", "#e74c3c");
        return;
    }
    finalizarPruebaActual({ interrumpida: false });
};

// Se registra en sesionState para que dispositivo-conexion.js pueda cerrar la prueba en curso al detectar pérdida de señal, sin importar este módulo directamente
sesionState.interrumpirPruebaActual = () => finalizarPruebaActual({ interrumpida: true });

// Igual que arriba pero para cuando la señal se cae sin prueba activa, solo deja el marcador en el CSV
sesionState.marcarInterrupcionSenal = () => agregarFilaMarcador("INTERRUPCION_SENAL");

// Marcador libre sin tocar la prueba activa, usado durante reconexión automática
sesionState.agregarMarcadorLibre = (texto) => agregarFilaMarcador(texto);

// Botón "Finalizar sesión"
document.getElementById("stopRecording").onclick = () => {
    if (isPaused) {
        showStatusMessage("Reanuda y termina la prueba antes de finalizar la sesión", "#e74c3c");
        return;
    }
    if (pruebaActiva !== "NINGUNA") {
        showStatusMessage("Debes presionar 'TERMINAR PRUEBA' antes de cerrar la sesión", "#ffa500");
        return;
    }

    sesionState.recording = false;
    clearInterval(timerInterval);
    sesionState.currentMarker = "SESSION_END";
    dibujarMarcador('session_end', 'SESIÓN FINALIZADA', '#d90429');

    const elRingWrap = document.getElementById('timerRingWrap');
    if (elRingWrap) elRingWrap.classList.remove('is-recording');
    const elStatusLabel = document.getElementById('recordingStatusLabel');
    if (elStatusLabel) elStatusLabel.innerText = 'Finalizada';

    document.getElementById("stopRecording").style.display = "none";
    document.getElementById("trialSelectorArea").style.display = "none";
    document.getElementById("stopTrial").style.display = "none";
    document.getElementById("pauseTrial").style.display = "none";

    document.getElementById("downloadCSV").style.display = "flex";
    document.getElementById("btnNuevaSesion").style.display = "block";

    guardarResultadosBBDD();

    if (sesionState.huboInterrupcionConexion) {
        showStatusMessage(" Ojo: hubo al menos una interrupción de señal durante esta sesión. Revisa el CSV antes de usarlo para diagnóstico.", "#ffa500");
    } else {
        showStatusMessage("Sesión cerrada. Datos guardados y listos para exportar.", "#2c3e50");
    }
};

// Recorre las filas una vez y empareja cada START con su propio END/INTERRUMPIDA cronológico, para que un reintento no se mezcle con el anterior
function construirParesDePruebas(filas) {
    const pares = {};
    const pendientes = {};

    filas.forEach((fila, idx) => {
        // evita que el .+ greedy anterior se tragara los datos de sensores como parte del nombre
        const matchStart = fila.match(/,([^,]+)_START$/);
        if (matchStart) {
            pendientes[matchStart[1]] = idx;
            return;
        }
        const matchFin = fila.match(/,([^,]+)_END_DUR_[\d.]+s$/);
        if (matchFin && pendientes[matchFin[1]] !== undefined) {
            (pares[matchFin[1]] ||= []).push({ tipo: 'exito', idxInicio: pendientes[matchFin[1]], idxFin: idx });
            delete pendientes[matchFin[1]];
            return;
        }
        const matchInterr = fila.match(/,([^,]+)_INTERRUMPIDA_[\d.]+s$/);
        if (matchInterr && pendientes[matchInterr[1]] !== undefined) {
            (pares[matchInterr[1]] ||= []).push({ tipo: 'interrumpida', idxInicio: pendientes[matchInterr[1]], idxFin: idx });
            delete pendientes[matchInterr[1]];
        }
    });

    return { pares, pendientes };
}

// Recorta csvRows en un CSV por prueba, usando los pares START/END ya emparejados
function dividirCSVPorPruebas() {
    const encabezado = sesionState.csvRows[0];
    const filas = sesionState.csvRows.slice(1);
    const archivos = [];
    // Guarda el índice real de cada archivo, por si algún par falta y el array queda desalineado
    const indices = [];

    const { pares, pendientes } = construirParesDePruebas(filas);
    const siguienteIndice = {};

    sesionState.listaDePruebasRealizadas.forEach((prueba, i) => {
        const clave = `${prueba.nombre}_exito`;
        const n = siguienteIndice[clave] || 0;
        siguienteIndice[clave] = n + 1;

        const exitosos = (pares[prueba.nombre] || []).filter(p => p.tipo === 'exito');
        const par = exitosos[n];
        if (!par) return;

        const filasDeLaPrueba = filas.slice(par.idxInicio, par.idxFin + 1);
        const contenido = "\ufeff" + [encabezado, ...filasDeLaPrueba].join("\n");
        const blob = new Blob([contenido], { type: 'text/csv' });
        archivos.push(new File([blob], `prueba_${i + 1}_${prueba.nombre}_${Date.now()}.csv`, { type: 'text/csv' }));
        indices.push(i);
    });

    // Pruebas cortadas por pérdida de señal: se exporta igual lo grabado, como evidencia
    sesionState.pruebasInterrumpidas.forEach((prueba, i) => {
        const clave = `${prueba.nombre}_interrumpida`;
        const n = siguienteIndice[clave] || 0;
        siguienteIndice[clave] = n + 1;

        const interrumpidos = (pares[prueba.nombre] || []).filter(p => p.tipo === 'interrumpida');
        let par = interrumpidos[n];

        // Si nunca se escribió el marcador INTERRUMPIDA, usa el START abierto y exporta hasta el final
        if (!par && pendientes[prueba.nombre] !== undefined) {
            par = { idxInicio: pendientes[prueba.nombre], idxFin: filas.length - 1 };
            delete pendientes[prueba.nombre];
        }
        if (!par) return;

        const filasDeLaPrueba = filas.slice(par.idxInicio, par.idxFin + 1);
        const contenido = "\ufeff" + [encabezado, ...filasDeLaPrueba].join("\n");
        const blob = new Blob([contenido], { type: 'text/csv' });
        archivos.push(new File([blob], `prueba_INCOMPLETA_${i + 1}_${prueba.nombre}_${Date.now()}.csv`, { type: 'text/csv' }));
    });

    return { archivos, indices };
}

// Envía el CSV completo + resumen de la sesión al backend para guardarlos
async function guardarResultadosBBDD() {
    const urlParams = new URLSearchParams(window.location.search);
    const idDispositivoURL = urlParams.get('dev');

    function promedioDe(campo) {
        if (!sesionState.historialEvolucionBandas.length) return 0;
        const suma = sesionState.historialEvolucionBandas.reduce((acc, punto) => acc + parseFloat(punto[campo] || 0), 0);
        return suma / sesionState.historialEvolucionBandas.length;
    }

    const avgTheta = promedioDe('theta');
    const avgAlpha = promedioDe('alpha');
    const avgBeta = promedioDe('beta');
    const nombrePaciente = document.getElementById("sesion-nombre").innerText || "Paciente Desconocido";
    const duracionTotal = ((Date.now() - liveState.sessionStartTime) / 1000).toFixed(2);

    // Arma el CSV directo en memoria, sin pasar por disco
    const csvContent = "\ufeff" + sesionState.csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const archivoCSV = new File([blob], `sesion_eeg_${Date.now()}.csv`, { type: 'text/csv' });

    const formData = new FormData();
    if (sesionState.idSesionActual) formData.append('idSesion', sesionState.idSesionActual); // evita duplicar la fila en BD
    formData.append('pacienteId', idPacienteURL);
    formData.append('dispositivoId', idDispositivoURL);
    formData.append('nombrePaciente', nombrePaciente);
    formData.append('duracionTotal', duracionTotal);
    formData.append('totalPruebas', sesionState.listaDePruebasRealizadas.length);
    formData.append('avgAlpha', avgAlpha);
    formData.append('avgBeta', avgBeta);
    formData.append('avgTheta', avgTheta);
    formData.append('interrupcionConexion', sesionState.huboInterrupcionConexion ? 1 : 0);
    formData.append('pruebasDetalle', JSON.stringify(sesionState.listaDePruebasRealizadas));
    formData.append('pruebasInterrumpidas', JSON.stringify(sesionState.pruebasInterrumpidas)); // el backend puede ignorarlo si aún no lo usa
    formData.append('evolucionBandas', JSON.stringify(sesionState.historialEvolucionBandas));
    formData.append('archivo_csv', archivoCSV);

    const { archivos: archivosCSVPorPrueba, indices: indicesCSVPorPrueba } = dividirCSVPorPruebas();
    archivosCSVPorPrueba.forEach(archivo => formData.append('archivos_csv_pruebas', archivo));
    // Índice real dentro de listaDePruebasRealizadas al que corresponde cada archivo, en el mismo orden de subida
    formData.append('indicesCSVPruebas', JSON.stringify(indicesCSVPorPrueba));

    console.log("Enviando datos y archivo CSV a NeuroGuardx...");

    try {
        const response = await fetch(`${API_BASE}/api/guardar-sesion-completa`, {
            method: 'POST',
            body: formData
        });
        const resultado = await response.json();

        if (resultado.success) {
            console.log("Sesión y CSV guardados correctamente.");
            showStatusMessage("Datos y CSV sincronizados con éxito", "#2ecc71");
        } else {
            throw new Error(resultado.error);
        }
    } catch (error) {
        console.error("Error al guardar en BBDD:", error);
        showStatusMessage("Error al sincronizar con el servidor", "#e74c3c");
    }
}

// Flecha para volver al perfil del paciente sin cerrar la sesión formalmente
const btnVolverPerfil = document.getElementById("btnVolverPerfil");
if (btnVolverPerfil) {
    btnVolverPerfil.onclick = () => {
        if (sesionState.recording) {
            const confirmar = window.confirm(
                "Hay una sesión en curso que aún no se ha guardado. Si sales ahora, se perderán los datos grabados. ¿Salir de todas formas?"
            );
            if (!confirmar) return;
        }
        if (idPacienteURL) {
            window.location.href = `perfilPacientes.html?id=${idPacienteURL}`;
        } else {
            window.location.href = 'perfilPacientes.html';
        }
    };
}

// Botón "Nueva sesión": desconecta el dispositivo y regresa al perfil del paciente
document.getElementById("btnNuevaSesion").onclick = () => {
    detenerAdquisicion();

    if (idPacienteURL) {
        window.location.href = `perfilPacientes.html?id=${idPacienteURL}`;
    } else {
        window.location.href = 'perfilPacientes.html';
    }
};

// Botón "Descargar CSV"
document.getElementById("downloadCSV").onclick = () => {
    if (sesionState.csvRows.length < 2) {
        showStatusMessage("No hay datos para exportar", "#ffa500");
        return;
    }

    const csvContent = sesionState.csvRows.join("\n");
    const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    link.setAttribute("download", `EEG_sesion_${sesionState.idSesionActual || 'sinID'}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showStatusMessage(" Archivo descargado", "#26a69a");
};