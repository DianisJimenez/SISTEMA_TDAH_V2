// mock-muse.js
// Simulador de la diadema Muse para probar TODO el pipeline (filtrado, FFT,
// artefactos, CSV) sin tener el hardware en mano.
//
// USO EN main.js:
//   import { connectMuse } from "web-muse";        // <- línea original, coméntala
//   import { connectMuse } from "./mock-muse.js";  // <- agrega esta para probar
//
// Cuando llegue la diadema real, vuelves a la importación original y ya.

// ---- Parámetros que puedes tocar para simular distintos escenarios ----
const CONFIG = {
    sampleRate: 256,
    ruidoBase: 15,           // amplitud del ruido de fondo (uV)
    thetaAmp: 20,            // amplitud de la onda theta simulada (uV)
    thetaFreq: 6,            // Hz (dentro de 4-8Hz)
    alphaAmp: 15,
    alphaFreq: 10,           // Hz (dentro de 8-13Hz)
    betaAmp: 8,
    betaFreq: 20,            // Hz (dentro de 13-30Hz)
    parpadeoCadaMs: 4000,    // cada cuánto se simula un parpadeo (artefacto)
    parpadeoAmp: 200,        // amplitud del artefacto (supera UMBRAL_AMPLITUD_UV)
    parpadeoDuracionMs: 150,
    simularCaidaSenal: false,   // pon true para probar reconexión/pérdida de señal
    caidaEnMs: 8000,            // a los cuántos ms de conexión se "cae" la señal
    caidaDuracionMs: 3000
};

function crearCanal(offsetFase = 0) {
    const t0 = Date.now();
    let ultimoParpadeo = 0;

    return {
        read() {
            const ahora = Date.now();
            const tSeg = (ahora - t0) / 1000;

            // Simular caída de señal (para probar el bloque FASE 3)
            if (CONFIG.simularCaidaSenal) {
                const msDesdeInicio = ahora - t0;
                if (msDesdeInicio > CONFIG.caidaEnMs &&
                    msDesdeInicio < CONFIG.caidaEnMs + CONFIG.caidaDuracionMs) {
                    return null; // simula lectura nula/fallida
                }
            }

            let valor =
                CONFIG.thetaAmp * Math.sin(2 * Math.PI * CONFIG.thetaFreq * tSeg + offsetFase) +
                CONFIG.alphaAmp * Math.sin(2 * Math.PI * CONFIG.alphaFreq * tSeg + offsetFase) +
                CONFIG.betaAmp  * Math.sin(2 * Math.PI * CONFIG.betaFreq  * tSeg + offsetFase) +
                (Math.random() - 0.5) * 2 * CONFIG.ruidoBase;

            // Simular parpadeo periódico (artefacto de amplitud)
            if (ahora - ultimoParpadeo > CONFIG.parpadeoCadaMs) {
                if (ahora - ultimoParpadeo < CONFIG.parpadeoCadaMs + CONFIG.parpadeoDuracionMs) {
                    valor += CONFIG.parpadeoAmp * Math.random();
                } else {
                    ultimoParpadeo = ahora;
                }
            }

            return valor;
        }
    };
}

export async function connectMuse() {
    console.log("🧪 [MOCK] Conectando a Muse simulada (no es hardware real)");

    // Pequeño delay para simular el tiempo real de conexión BLE
    await new Promise(r => setTimeout(r, 500));

    return {
        eeg: [crearCanal(0), crearCanal(0.5), crearCanal(1.0), crearCanal(1.5)], // tp9, af7, af8, tp10
        accelerometer: [
            { read: () => 0 + (Math.random() - 0.5) * 0.02 },
            { read: () => 0 + (Math.random() - 0.5) * 0.02 },
            { read: () => 1 + (Math.random() - 0.5) * 0.02 } // ~1g en reposo
        ],
        gyroscope: [
            { read: () => (Math.random() - 0.5) * 0.1 },
            { read: () => (Math.random() - 0.5) * 0.1 },
            { read: () => (Math.random() - 0.5) * 0.1 }
        ],
        telemetry: { batteryLevel: 78 },
        disconnect() {
            console.log("🧪 [MOCK] Muse simulada desconectada");
        }
    };
}