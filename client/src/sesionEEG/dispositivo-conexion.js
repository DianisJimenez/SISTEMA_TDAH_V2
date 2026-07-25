//import { connectMuse } from "web-muse"; // descomentar cuando se use la diadema real
import { connectMuse } from "./mock-muse.js";
import { liveState } from './state.js';
import { sesionState } from './sesion-state.js';
import { showStatusMessage } from './ui.js';
import {
    resetearFiltros, applyFilters, computeBands, detectarArtefacto,
    bufferSize, stepSize
} from './filtros-bandas.js';
import {
    initThreeJS, initChart, initEEGChart, updateChart,
    resetChartData, refreshEegChart, eegDataBuffer
} from './visual3d-graficas.js';

let scene; // solo para saber si el 3D ya se inicializó
let muse;
let intervalId, batteryInterval, accelInterval, gyroInterval;

// Buffers de señal filtrada usados para calcular bandas
let bandBuffers = { tp9: [], af7: [], af8: [], tp10: [] };
let ultimasBandas = { theta: 0, alpha: 0, beta: 0 };
let bandasDisponibles = false;    // true cuando ya hubo al menos un cálculo real de bandas
let bandaFrescaPendiente = false; // marca si la banda de esta fila es un cálculo nuevo

// Detección de desconexión por fallos consecutivos de lectura
let fallosConsecutivos = 0;
const UMBRAL_FALLOS_DESCONEXION = 512; // ~2 segundos a 256Hz
let conexionPerdidaAvisada = false;

let ultimaMuestraRaw = null; // para descartar lecturas BLE duplicadas

// Corta la adquisición y desconecta el Muse, usado también al iniciar nueva sesión
export function detenerAdquisicion() {
    if (muse) {
        try { muse.disconnect(); } catch (e) { /* ya estaba desconectado */ }
    }
    clearInterval(intervalId);
    clearInterval(batteryInterval);
    clearInterval(accelInterval);
    clearInterval(gyroInterval);
}

// Botón "Conectar": vincula el dispositivo y arranca la adquisición de datos
document.getElementById("connect").onclick = async () => {
    try {
        // Limpia intervalos viejos (por si es una reconexión)
        clearInterval(intervalId);
        clearInterval(batteryInterval);
        clearInterval(accelInterval);
        clearInterval(gyroInterval);
        fallosConsecutivos = 0;
        conexionPerdidaAvisada = false;
        resetearFiltros();
        bandasDisponibles = false;
        bandaFrescaPendiente = false;

        // Arranca el reloj de la gráfica en vivo desde este momento
        liveState.chartStartTime = Date.now();
        resetChartData();

        muse = await connectMuse();
        showStatusMessage("Dispositivo conectado correctamente");

        const elDeviceStatus = document.getElementById("device-status");
        if (elDeviceStatus) {
            elDeviceStatus.innerHTML = '<i class="ri-circle-fill me-1" style="font-size:8px;"></i>Conectado';
            elDeviceStatus.className = "fw-bold text-success";
        }

        document.getElementById("startRecording").disabled = false;
        document.getElementById("startTrial").disabled = false;

        if (!scene) { scene = true; initThreeJS(); }
        initChart();
        initEEGChart();

        // Lee el nivel de batería cada 3 segundos
        batteryInterval = setInterval(() => {
            try {
                let batteryLevel = muse?.telemetry?.batteryLevel || muse?.batteryLevel || muse?.battery?.level;
                if (batteryLevel != null) {
                    const b = Math.min(batteryLevel, 100);
                    document.getElementById("battery").innerText = b;
                }
            } catch (e) { console.error(e); }
        }, 3000);

        // Loop principal de adquisición EEG (256 lecturas por segundo)
        intervalId = setInterval(() => {
            try {
                const eegData = muse.eeg.map(b => b.read());
                if (!eegData.includes(null)) {
                    fallosConsecutivos = 0;
                    if (conexionPerdidaAvisada) {
                        // La señal se recuperó tras una caída
                        conexionPerdidaAvisada = false;
                        showStatusMessage("✅ Señal recuperada, la grabación continúa", "#2ecc71");
                        const elDeviceStatus2 = document.getElementById("device-status");
                        if (elDeviceStatus2) {
                            elDeviceStatus2.innerHTML = '<i class="ri-circle-fill me-1" style="font-size:8px;"></i>Conectado';
                            elDeviceStatus2.className = "fw-bold text-success";
                        }
                    }

                    // Descarta si es la misma muestra BLE repetida
                    const esMuestraDuplicada = ultimaMuestraRaw !== null &&
                        eegData[0] === ultimaMuestraRaw[0] && eegData[1] === ultimaMuestraRaw[1] &&
                        eegData[2] === ultimaMuestraRaw[2] && eegData[3] === ultimaMuestraRaw[3];
                    ultimaMuestraRaw = eegData;
                    if (esMuestraDuplicada) return;

                    document.getElementById("tp9").innerText = eegData[0].toFixed(2);
                    document.getElementById("af7").innerText = eegData[1].toFixed(2);
                    document.getElementById("af8").innerText = eegData[2].toFixed(2);
                    document.getElementById("tp10").innerText = eegData[3].toFixed(2);

                    // Filtra los 4 canales antes de usarlos
                    const filteredTP9 = applyFilters(eegData[0], 'tp9');
                    const filteredAF7 = applyFilters(eegData[1], 'af7');
                    const filteredAF8 = applyFilters(eegData[2], 'af8');
                    const filteredTP10 = applyFilters(eegData[3], 'tp10');

                    eegDataBuffer.tp9.push(filteredTP9); eegDataBuffer.tp9.shift();
                    eegDataBuffer.af7.push(filteredAF7); eegDataBuffer.af7.shift();
                    eegDataBuffer.af8.push(filteredAF8); eegDataBuffer.af8.shift();
                    eegDataBuffer.tp10.push(filteredTP10); eegDataBuffer.tp10.shift();

                    refreshEegChart();

                    const artefactoMuestra = detectarArtefacto(
                        [filteredTP9, filteredAF7, filteredAF8, filteredTP10],
                        liveState.accelX, liveState.accelY, liveState.accelZ
                    );

                    // Si se está grabando, arma y guarda la fila del CSV
                    if (sesionState.recording) {
                        const bandaActualizada = bandaFrescaPendiente ? 1 : 0;
                        bandaFrescaPendiente = false;

                        const porCanal = ultimasBandas.porCanal;
                        const col = (v) => bandasDisponibles ? v.toFixed(2) : ""; // vacío si aún no hay bandas reales

                        const row = [
                            Date.now(),
                            eegData[0].toFixed(2), eegData[1].toFixed(2), eegData[2].toFixed(2), eegData[3].toFixed(2),
                            col(ultimasBandas.theta),
                            col(ultimasBandas.alpha),
                            col(ultimasBandas.beta),
                            bandasDisponibles ? col(porCanal.tp9.theta_pct) : "",
                            bandasDisponibles ? col(porCanal.tp9.alpha_pct) : "",
                            bandasDisponibles ? col(porCanal.tp9.beta_pct) : "",
                            bandasDisponibles ? col(porCanal.af7.theta_pct) : "",
                            bandasDisponibles ? col(porCanal.af7.alpha_pct) : "",
                            bandasDisponibles ? col(porCanal.af7.beta_pct) : "",
                            bandasDisponibles ? col(porCanal.af8.theta_pct) : "",
                            bandasDisponibles ? col(porCanal.af8.alpha_pct) : "",
                            bandasDisponibles ? col(porCanal.af8.beta_pct) : "",
                            bandasDisponibles ? col(porCanal.tp10.theta_pct) : "",
                            bandasDisponibles ? col(porCanal.tp10.alpha_pct) : "",
                            bandasDisponibles ? col(porCanal.tp10.beta_pct) : "",
                            bandaActualizada,
                            liveState.accelX.toFixed(3), liveState.accelY.toFixed(3), liveState.accelZ.toFixed(3),
                            liveState.gyroX.toFixed(3), liveState.gyroY.toFixed(3), liveState.gyroZ.toFixed(3),
                            artefactoMuestra,
                            sesionState.currentMarker
                        ].join(",");
                        sesionState.csvRows.push(row);

                        if (sesionState.currentMarker !== "none") sesionState.currentMarker = "none";
                    }

                    // Alimenta los buffers usados para calcular bandas
                    bandBuffers.tp9.push(filteredTP9);
                    bandBuffers.af7.push(filteredAF7);
                    bandBuffers.af8.push(filteredAF8);
                    bandBuffers.tp10.push(filteredTP10);

                    // Cuando el buffer llega a 1 segundo de datos, calcula las bandas
                    if (bandBuffers.af7.length >= bufferSize) {
                        const bandasTP9 = computeBands(bandBuffers.tp9);
                        const bandasAF7 = computeBands(bandBuffers.af7);
                        const bandasAF8 = computeBands(bandBuffers.af8);
                        const bandasTP10 = computeBands(bandBuffers.tp10);

                        // Promedio de los 4 canales para mostrar en pantalla/gráfica
                        const thetaProm = (bandasTP9.theta_pct + bandasAF7.theta_pct + bandasAF8.theta_pct + bandasTP10.theta_pct) / 4;
                        const alphaProm = (bandasTP9.alpha_pct + bandasAF7.alpha_pct + bandasAF8.alpha_pct + bandasTP10.alpha_pct) / 4;
                        const betaProm = (bandasTP9.beta_pct + bandasAF7.beta_pct + bandasAF8.beta_pct + bandasTP10.beta_pct) / 4;

                        ultimasBandas = {
                            theta: thetaProm, alpha: alphaProm, beta: betaProm,
                            porCanal: { tp9: bandasTP9, af7: bandasAF7, af8: bandasAF8, tp10: bandasTP10 }
                        };
                        bandasDisponibles = true;
                        bandaFrescaPendiente = true;

                        document.getElementById("theta").innerText = thetaProm.toFixed(2);
                        document.getElementById("alpha").innerText = alphaProm.toFixed(2);
                        document.getElementById("beta").innerText = betaProm.toFixed(2);

                        updateChart(thetaProm, alphaProm, betaProm);

                        // Guarda el punto en el historial de la sesión (para reportes)
                        if (sesionState.recording) {
                            sesionState.historialEvolucionBandas.push({
                                t: ((Date.now() - liveState.sessionStartTime) / 1000).toFixed(2),
                                theta: thetaProm.toFixed(2),
                                alpha: alphaProm.toFixed(2),
                                beta: betaProm.toFixed(2),
                                theta_tp9_abs: bandasTP9.theta_abs.toFixed(4), alpha_tp9_abs: bandasTP9.alpha_abs.toFixed(4), beta_tp9_abs: bandasTP9.beta_abs.toFixed(4),
                                theta_af7_abs: bandasAF7.theta_abs.toFixed(4), alpha_af7_abs: bandasAF7.alpha_abs.toFixed(4), beta_af7_abs: bandasAF7.beta_abs.toFixed(4),
                                theta_af8_abs: bandasAF8.theta_abs.toFixed(4), alpha_af8_abs: bandasAF8.alpha_abs.toFixed(4), beta_af8_abs: bandasAF8.beta_abs.toFixed(4),
                                theta_tp10_abs: bandasTP10.theta_abs.toFixed(4), alpha_tp10_abs: bandasTP10.alpha_abs.toFixed(4), beta_tp10_abs: bandasTP10.beta_abs.toFixed(4)
                            });
                        }

                        // Traslape de ventanas: conserva la mitad más reciente del buffer
                        bandBuffers.tp9 = bandBuffers.tp9.slice(stepSize);
                        bandBuffers.af7 = bandBuffers.af7.slice(stepSize);
                        bandBuffers.af8 = bandBuffers.af8.slice(stepSize);
                        bandBuffers.tp10 = bandBuffers.tp10.slice(stepSize);
                    }
                } else {
                    manejarFalloDeLectura(); // lectura nula: posible desconexión
                }
            } catch (e) {
                console.error(e);
                manejarFalloDeLectura();
            }
        }, 1000 / 256);

        // Centraliza qué pasa cuando fallan varias lecturas seguidas (posible desconexión)
        function manejarFalloDeLectura() {
            fallosConsecutivos++;
            if (fallosConsecutivos >= UMBRAL_FALLOS_DESCONEXION && !conexionPerdidaAvisada) {
                conexionPerdidaAvisada = true;
                const elDeviceStatus3 = document.getElementById("device-status");
                if (elDeviceStatus3) {
                    elDeviceStatus3.innerHTML = '<i class="ri-circle-fill me-1" style="font-size:8px;"></i>Sin señal';
                    elDeviceStatus3.className = "fw-bold text-danger";
                }
                if (sesionState.recording) {
                    sesionState.huboInterrupcionConexion = true;
                    showStatusMessage("⚠️ Se perdió la señal del dispositivo. Los datos grabados hasta ahora están a salvo — reconecta para continuar.", "#e74c3c");
                } else {
                    showStatusMessage("⚠️ Se perdió la señal del dispositivo. Vuelve a presionar Conectar.", "#e74c3c");
                }
            }
        }

        // Lee el acelerómetro cada 10ms (mueve el modelo 3D)
        accelInterval = setInterval(() => {
            const accelData = muse.accelerometer.map(b => b.read());
            if (!accelData.includes(null)) {
                liveState.accelX = accelData[0]; liveState.accelY = accelData[1]; liveState.accelZ = accelData[2];
                document.getElementById("accelX").innerText = liveState.accelX.toFixed(2);
                document.getElementById("accelY").innerText = liveState.accelY.toFixed(2);
                document.getElementById("accelZ").innerText = liveState.accelZ.toFixed(2);
            }
        }, 10);

        // Lee el giroscopio cada 10ms
        gyroInterval = setInterval(() => {
            const gyroData = muse.gyroscope.map(b => b.read());
            if (!gyroData.includes(null)) {
                liveState.gyroX = gyroData[0];
                liveState.gyroY = gyroData[1];
                liveState.gyroZ = gyroData[2];

                const elX = document.getElementById("gyroX");
                const elY = document.getElementById("gyroY");
                const elZ = document.getElementById("gyroZ");
                if (elX) elX.innerText = liveState.gyroX.toFixed(2);
                if (elY) elY.innerText = liveState.gyroY.toFixed(2);
                if (elZ) elZ.innerText = liveState.gyroZ.toFixed(2);
            }
        }, 10);
    } catch (e) {
        console.error(e);
        showStatusMessage("Error de conexión, Vuelve a vincular el dispositivo", "#d90429");
    }
};

// Botón "Desconectar"
document.getElementById("disconnect").onclick = () => {
    if (muse) {
        try {
            muse.disconnect();
        } catch (e) {
            console.log("Muse ya estaba fuera de línea");
        }
    }
    window.location.reload();
};
