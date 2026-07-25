import FFT from "fft.js";

// Filtro notch (elimina el ruido eléctrico de 50Hz)
const notch50 = {
    b0: 0.9565, b1: -1.1822, b2: 0.9565,
    a1: -1.1822, a2: 0.9131,
    v1: { tp9: 0, af7: 0, af8: 0, tp10: 0 },
    v2: { tp9: 0, af7: 0, af8: 0, tp10: 0 }
};

// Filtro pasa-altas (quita el offset/deriva de la señal)
const highPass05 = {
    alpha: 0.9878,
    prevRaw: { tp9: 0, af7: 0, af8: 0, tp10: 0 },
    prevFilt: { tp9: 0, af7: 0, af8: 0, tp10: 0 }
};

// Reinicia la memoria de los filtros (se llama al conectar / iniciar sesión)
export function resetearFiltros() {
    notch50.v1 = { tp9: 0, af7: 0, af8: 0, tp10: 0 };
    notch50.v2 = { tp9: 0, af7: 0, af8: 0, tp10: 0 };
    highPass05.prevRaw = { tp9: 0, af7: 0, af8: 0, tp10: 0 };
    highPass05.prevFilt = { tp9: 0, af7: 0, af8: 0, tp10: 0 };
}

// Aplica notch + pasa-altas a una muestra de un canal
export function applyFilters(rawData, channelKey) {
    let x = rawData;
    let v = x - notch50.a1 * notch50.v1[channelKey] - notch50.a2 * notch50.v2[channelKey];
    let yNotch = notch50.b0 * v + notch50.b1 * notch50.v1[channelKey] + notch50.b2 * notch50.v2[channelKey];
    notch50.v2[channelKey] = notch50.v1[channelKey];
    notch50.v1[channelKey] = v;

    let yHP = highPass05.alpha * (highPass05.prevFilt[channelKey] + yNotch - highPass05.prevRaw[channelKey]);
    highPass05.prevRaw[channelKey] = yNotch;
    highPass05.prevFilt[channelKey] = yHP;

    return yHP;
}

export const sampleRate = 256;
export const bufferSize = 256; // 1 segundo de datos por ventana de análisis

// Traslape de ventanas: cada cálculo reutiliza la mitad de la ventana anterior
const windowOverlap = 0.5;
export const stepSize = Math.floor(bufferSize * (1 - windowOverlap));

// Umbrales para detectar artefactos (parpadeos, movimiento brusco)
const UMBRAL_AMPLITUD_UV = 150;
const UMBRAL_ACEL_G = 0.35;

// Suaviza la señal antes del FFT para evitar distorsión entre frecuencias
function hanningWindow(signal) {
    const N = signal.length;
    const out = new Array(N);
    for (let i = 0; i < N; i++) {
        const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
        out[i] = signal[i] * w;
    }
    return out;
}

// Calcula la energía de las bandas theta/alpha/beta con la Transformada de Fourier
export function computeBands(signal) {
    const windowed = hanningWindow(signal);
    const fft = new FFT(bufferSize);
    const out = fft.createComplexArray();
    const data = fft.toComplexArray(windowed);
    fft.transform(out, data);

    let theta = 0, alpha = 0, beta = 0;
    let countT = 0, countA = 0, countB = 0;

    // Recorre cada frecuencia calculada y la clasifica en su banda
    for (let i = 0; i < bufferSize / 2; i++) {
        const re = out[2 * i];
        const im = out[2 * i + 1];
        const mag = Math.sqrt(re * re + im * im);
        const freq = i * sampleRate / bufferSize;

        if (freq < 0.16 || freq > 40) continue;
        if (Math.abs(freq - 50) < 1 || Math.abs(freq - 60) < 1) continue; // descarta ruido eléctrico

        if (freq >= 4 && freq < 8) { theta += mag; countT++; }
        if (freq >= 8 && freq < 13) { alpha += mag; countA++; }
        if (freq >= 13 && freq <= 30) { beta += mag; countB++; }
    }

    const avgTheta = countT > 0 ? theta / countT : 0;
    const avgAlpha = countA > 0 ? alpha / countA : 0;
    const avgBeta = countB > 0 ? beta / countB : 0;

    // Convierte energía absoluta a porcentaje relativo para la gráfica
    const totalEnergy = avgTheta + avgAlpha + avgBeta;
    const pctFactor = totalEnergy > 0 ? 100 / totalEnergy : 0;

    return {
        theta_abs: avgTheta, alpha_abs: avgAlpha, beta_abs: avgBeta,
        theta_pct: avgTheta * pctFactor, alpha_pct: avgAlpha * pctFactor, beta_pct: avgBeta * pctFactor
    };
}

// Marca una muestra como "artefacto" si hay amplitud rara o movimiento brusco
export function detectarArtefacto(valoresFiltrados, accelX, accelY, accelZ) {
    const amplitudSospechosa = valoresFiltrados.some(v => Math.abs(v) > UMBRAL_AMPLITUD_UV);
    const magnitudAcel = Math.sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
    const movimientoSospechoso = Math.abs(magnitudAcel - 1) > UMBRAL_ACEL_G;
    return (amplitudSospechosa || movimientoSospechoso) ? 1 : 0;
}

// Promedia las bandas solo dentro del tramo de tiempo de una prueba específica
export function promediarBandasEnRango(historial, inicioRelSeg, finRelSeg) {
    const puntos = historial.filter(p => {
        const t = parseFloat(p.t);
        return t >= inicioRelSeg && t <= finRelSeg;
    });

    if (!puntos.length) {
        return { avgTheta: 0, avgAlpha: 0, avgBeta: 0, muestras: 0 };
    }

    const suma = puntos.reduce((acc, p) => {
        acc.theta += parseFloat(p.theta) || 0;
        acc.alpha += parseFloat(p.alpha) || 0;
        acc.beta += parseFloat(p.beta) || 0;
        return acc;
    }, { theta: 0, alpha: 0, beta: 0 });

    return {
        avgTheta: suma.theta / puntos.length,
        avgAlpha: suma.alpha / puntos.length,
        avgBeta: suma.beta / puntos.length,
        muestras: puntos.length
    };
}