import FFT from "fft.js";

export const sampleRate = 256;
export const bufferSize = 256; // 1 segundo de datos por ventana de análisis

// Frecuencia de la red eléctrica, México usa 60Hz, en Europa sería 50
export const MAINS_FREQUENCY = 60;

// Notch biquad (RBJ) para eliminar el ruido de la red eléctrica
function disenarNotch(f0, Q, fs) {
    const w0 = 2 * Math.PI * f0 / fs;
    const alpha = Math.sin(w0) / (2 * Q);
    const a0 = 1 + alpha;
    return {
        b0: 1 / a0,
        b1: -2 * Math.cos(w0) / a0,
        b2: 1 / a0,
        a1: -2 * Math.cos(w0) / a0,
        a2: (1 - alpha) / a0,
    };
}

// Pasa-altas de un polo (DC blocker) para quitar el offset/deriva de la señal
function disenarPasaAltas(fc, fs) {
    return Math.exp(-2 * Math.PI * fc / fs);
}

// Pasa-bajas de un polo para limitar el ancho de banda antes del FFT
function disenarPasaBajas(fc, fs) {
    const w0 = 2 * Math.PI * fc / fs;
    const b = 2 * Math.cos(w0) - 4;
    const disc = b * b - 4;
    const a = (-b - Math.sqrt(disc)) / 2;
    return 1 - a;
}

const NOTCH_Q = 30; // qué tan angosto es el notch, más alto = más angosto
const notch = {
    ...disenarNotch(MAINS_FREQUENCY, NOTCH_Q, sampleRate),
    v1: { tp9: 0, af7: 0, af8: 0, tp10: 0 },
    v2: { tp9: 0, af7: 0, af8: 0, tp10: 0 },
};

const highPass05 = {
    alpha: disenarPasaAltas(0.5, sampleRate),
    prevRaw: { tp9: 0, af7: 0, af8: 0, tp10: 0 },
    prevFilt: { tp9: 0, af7: 0, af8: 0, tp10: 0 },
};

const lowPass45 = {
    alpha: disenarPasaBajas(45, sampleRate),
    prev: { tp9: 0, af7: 0, af8: 0, tp10: 0 },
};

// Reinicia la memoria de los filtros, se llama al conectar o iniciar sesión
export function resetearFiltros() {
    notch.v1 = { tp9: 0, af7: 0, af8: 0, tp10: 0 };
    notch.v2 = { tp9: 0, af7: 0, af8: 0, tp10: 0 };
    highPass05.prevRaw = { tp9: 0, af7: 0, af8: 0, tp10: 0 };
    highPass05.prevFilt = { tp9: 0, af7: 0, af8: 0, tp10: 0 };
    lowPass45.prev = { tp9: 0, af7: 0, af8: 0, tp10: 0 };
}

// Limpia la señal de un canal: quita offset, ruido eléctrico y frecuencias altas
export function applyFilters(rawData, channelKey) {
    // 1) quita el offset
    const x = rawData;
    const yHP = highPass05.alpha * (highPass05.prevFilt[channelKey] + x - highPass05.prevRaw[channelKey]);
    highPass05.prevRaw[channelKey] = x;
    highPass05.prevFilt[channelKey] = yHP;

    // 2) quita el ruido de la red eléctrica
    const v = yHP - notch.a1 * notch.v1[channelKey] - notch.a2 * notch.v2[channelKey];
    const yNotch = notch.b0 * v + notch.b1 * notch.v1[channelKey] + notch.b2 * notch.v2[channelKey];
    notch.v2[channelKey] = notch.v1[channelKey];
    notch.v1[channelKey] = v;

    // 3) limita el ancho de banda
    const yLP = lowPass45.prev[channelKey] + lowPass45.alpha * (yNotch - lowPass45.prev[channelKey]);
    lowPass45.prev[channelKey] = yLP;

    return yLP;
}

// Cada cálculo reutiliza la mitad de la ventana anterior
const windowOverlap = 0.5;
export const stepSize = Math.floor(bufferSize * (1 - windowOverlap));

// Compensa la pérdida de energía que causa la ventana de Hanning
const GANANCIA_HANNING = 0.5;

// Umbrales por defecto, se usan solo si aún no hay calibración por sujeto
const UMBRAL_AMPLITUD_UV_DEFECTO = 150;
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

    for (let i = 0; i < bufferSize / 2; i++) {
        const re = out[2 * i];
        const im = out[2 * i + 1];
        const mag = Math.sqrt(re * re + im * im);
        const freq = i * sampleRate / bufferSize;

        if (freq < 0.16 || freq > 40) continue;

        if (freq >= 4 && freq < 8) { theta += mag; countT++; }
        if (freq >= 8 && freq < 13) { alpha += mag; countA++; }
        if (freq >= 13 && freq <= 30) { beta += mag; countB++; }
    }

    const avgTheta = (countT > 0 ? theta / countT : 0) / GANANCIA_HANNING;
    const avgAlpha = (countA > 0 ? alpha / countA : 0) / GANANCIA_HANNING;
    const avgBeta = (countB > 0 ? beta / countB : 0) / GANANCIA_HANNING;

    const totalEnergy = avgTheta + avgAlpha + avgBeta;
    const pctFactor = totalEnergy > 0 ? 100 / totalEnergy : 0;

    return {
        theta_abs: avgTheta, alpha_abs: avgAlpha, beta_abs: avgBeta,
        theta_pct: avgTheta * pctFactor, alpha_pct: avgAlpha * pctFactor, beta_pct: avgBeta * pctFactor
    };
}

// Calcula el umbral de artefacto propio del sujeto usando los segundos en reposo
export function calcularUmbralAmplitud(valoresCalibracionPorCanal) {
    const todos = [
        ...valoresCalibracionPorCanal.tp9,
        ...valoresCalibracionPorCanal.af7,
        ...valoresCalibracionPorCanal.af8,
        ...valoresCalibracionPorCanal.tp10,
    ];
    if (todos.length < sampleRate) {
        // muy pocos datos, se usa el valor por defecto
        return UMBRAL_AMPLITUD_UV_DEFECTO;
    }
    const media = todos.reduce((a, b) => a + b, 0) / todos.length;
    const varianza = todos.reduce((a, b) => a + (b - media) ** 2, 0) / todos.length;
    const desviacion = Math.sqrt(varianza);
    return media + 3 * desviacion;
}

// Marca una muestra como artefacto si hay amplitud rara o movimiento brusco
export function detectarArtefacto(valoresFiltrados, accelX, accelY, accelZ, umbralAmplitud = UMBRAL_AMPLITUD_UV_DEFECTO) {
    const amplitudSospechosa = valoresFiltrados.some(v => Math.abs(v) > umbralAmplitud);
    const magnitudAcel = Math.sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
    const movimientoSospechoso = Math.abs(magnitudAcel - 1) > UMBRAL_ACEL_G;
    return (amplitudSospechosa || movimientoSospechoso) ? 1 : 0;
}

// Promedia las bandas solo dentro del tramo de tiempo de una prueba
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