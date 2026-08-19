import Chart from "chart.js/auto";
import annotationPlugin from 'chartjs-plugin-annotation';
import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { liveState } from './state.js';
import { showStatusMessage } from './ui.js';

Chart.register(annotationPlugin);

let scene, camera, renderer, head;
let rotX = 0, rotY = 0, rotZ = 0;
const gyroSensitivity = 0.4;

// Crea la escena 3D y carga el modelo de la cabeza
export function initThreeJS() {
    const canvas = document.getElementById("canvas3d");
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.z = 2.5;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;

    const light = new THREE.DirectionalLight(0xffffff, 1.5);
    light.position.set(5, 8, 5);
    light.castShadow = true;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0xcccccc, 1);
    scene.add(ambientLight);

    // Carga el modelo 3D y lo centra en la escena
    const loader = new GLTFLoader();
    loader.load('assets/head.glb', (gltf) => {
        head = new THREE.Group();
        const model = gltf.scene;

        const toRemove = [];
        model.traverse((node) => {
            if (node.isMesh && node.position.y < -0.3) {
                toRemove.push(node);
            }
        });
        toRemove.forEach(mesh => { mesh.parent.remove(mesh); });

        head.copy(model);
        const box = new THREE.Box3().setFromObject(head);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        head.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.8 / maxDim;
        head.scale.multiplyScalar(scale);

        camera.position.z = 2.0;
        camera.lookAt(0, 0, 0);

        head.castShadow = true;
        head.receiveShadow = true;
        head.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });
        scene.add(head);
        animate();
    }, undefined, (error) => {
        console.error('Error cargando modelo:', error);
    });
}

// Mueve la cabeza en tiempo real según el acelerómetro y giroscopio
function animate() {
    requestAnimationFrame(animate);
    if (head) {
        const { accelX, accelY, accelZ, gyroZ } = liveState;
        const magnitude = Math.sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
        if (magnitude > 0) {
            const roll = Math.atan2(accelY, accelZ);
            const pitch = Math.atan2(accelX, Math.sqrt(accelY * accelY + accelZ * accelZ));
            // suaviza el movimiento para que no tiemble
            rotX = rotX * 0.98 + pitch * 0.02;
            rotY = rotY * 0.98 + roll * 0.02;
        }
        rotZ = rotZ * 0.98 + (gyroZ * gyroSensitivity) * 0.02;

        // Limita cuánto puede girar la cabeza
        rotX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, rotX));
        rotY = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, rotY));
        rotZ = Math.max(-Math.PI / 1.5, Math.min(Math.PI / 1.5, rotZ));

        head.rotation.x = rotX;
        head.rotation.y = rotY;
        head.rotation.z = rotZ;
    }
    renderer.render(scene, camera);
}

const LIVE_WINDOW_SECONDS = 90; // cuántos segundos se ven en la vista en vivo

// Buffer de los 4 canales para el osciloscopio en vivo
export const eegDataBuffer = {
    tp9: Array(100).fill(0),
    af7: Array(100).fill(0),
    af8: Array(100).fill(0),
    tp10: Array(100).fill(0)
};

// Historial completo de bandas de toda la sesión, se usa tanto en vivo como en "sesión completa"
export const chartData = { theta: [], alpha: [], beta: [] };

let bandChart, eegChart;
let viewMode = 'live'; // 'live' | 'full'
let toggleBtn = null;

// Crea el osciloscopio de señal cruda, 4 canales
export function initEEGChart() {
    const ctx = document.getElementById("eegChart").getContext("2d");
    eegChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({ length: 100 }, (_, i) => i),
            datasets: [
                { label: 'TP9', data: eegDataBuffer.tp9, borderColor: '#FF5733', borderWidth: 1, pointRadius: 0, fill: false },
                { label: 'AF7', data: eegDataBuffer.af7, borderColor: '#33FF57', borderWidth: 1, pointRadius: 0, fill: false },
                { label: 'AF8', data: eegDataBuffer.af8, borderColor: '#3357FF', borderWidth: 1, pointRadius: 0, fill: false },
                { label: 'TP10', data: eegDataBuffer.tp10, borderColor: '#F333FF', borderWidth: 1, pointRadius: 0, fill: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { min: -100, max: 100 } },
            animation: { duration: 0 }
        }
    });
}

// Crea la gráfica de evolución de bandas theta/alpha/beta
export function initChart() {
    const ctx = document.getElementById("bandChart").getContext("2d");
    bandChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                { label: 'Theta', data: chartData.theta, borderColor: '#FF6B6B', backgroundColor: 'rgba(255, 107, 107, 0.1)', tension: 0.4, borderWidth: 2, pointRadius: 0, fill: true, parsing: false },
                { label: 'Alpha', data: chartData.alpha, borderColor: '#4ECDC4', backgroundColor: 'rgba(78, 205, 196, 0.1)', tension: 0.4, borderWidth: 2, pointRadius: 0, fill: true, parsing: false },
                { label: 'Beta', data: chartData.beta, borderColor: '#FFE66D', backgroundColor: 'rgba(255, 230, 109, 0.1)', tension: 0.4, borderWidth: 2, pointRadius: 0, fill: true, parsing: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { beginAtZero: true },
                // El eje X usa segundos reales, así los marcadores y los datos siempre coinciden
                x: {
                    type: 'linear',
                    min: 0,
                    max: LIVE_WINDOW_SECONDS,
                    title: { display: true, text: 'Tiempo transcurrido (segundos)' },
                    ticks: { callback: (value) => `${Math.round(value)}s` }
                }
            },
            animation: { duration: 0 },
            plugins: {
                // Tooltip al pasar el mouse sobre un punto
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: (context) => `Segundo: ${context[0].parsed.x.toFixed(1)}s`,
                        label: (context) => ` ${context.dataset.label}: ${context.parsed.y.toFixed(2)} µV`
                    }
                },
                // Aquí se guardan las líneas de inicio/fin de cada prueba
                annotation: { annotations: {} }
            },
            // Muestra en qué segundo se hizo clic
            onClick: (e) => {
                const points = bandChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
                if (points.length) {
                    const firstPoint = points[0];
                    const punto = bandChart.data.datasets[firstPoint.datasetIndex].data[firstPoint.index];
                    showStatusMessage(`📍 Punto inspeccionado en el segundo ${punto.x.toFixed(1)}`, "#4ECDC4");
                }
            }
        }
    });

    ensureToggleButton();
}

// Agrega un nuevo punto theta/alpha/beta a la gráfica
export function updateChart(theta, alpha, beta) {
    const segundoActual = (Date.now() - liveState.chartStartTime) / 1000;

    chartData.theta.push({ x: segundoActual, y: theta });
    chartData.alpha.push({ x: segundoActual, y: alpha });
    chartData.beta.push({ x: segundoActual, y: beta });

    if (viewMode === 'live') {
        aplicarVentanaEnVivo(segundoActual);
    }
    bandChart.update('none');
}

// Mueve la ventana visible para mostrar siempre los últimos segundos
function aplicarVentanaEnVivo(segundoActual) {
    if (segundoActual <= LIVE_WINDOW_SECONDS) {
        bandChart.options.scales.x.min = 0;
        bandChart.options.scales.x.max = LIVE_WINDOW_SECONDS;
    } else {
        bandChart.options.scales.x.min = segundoActual - LIVE_WINDOW_SECONDS;
        bandChart.options.scales.x.max = segundoActual;
    }
}

// Cambia entre ver los últimos segundos o toda la sesión completa
export function setViewMode(modo) {
    viewMode = modo;
    const ultimoPunto = chartData.theta[chartData.theta.length - 1];
    const segundoActual = ultimoPunto ? ultimoPunto.x : 0;

    if (modo === 'full') {
        bandChart.options.scales.x.min = 0;
        bandChart.options.scales.x.max = Math.max(segundoActual, LIVE_WINDOW_SECONDS);
    } else {
        aplicarVentanaEnVivo(segundoActual);
    }
    bandChart.update();
}

// Crea o reutiliza el botón "Ver sesión completa" y le pone el toggle
function ensureToggleButton() {
    if (toggleBtn) return;

    toggleBtn = document.getElementById('toggleVistaSesion');
    if (!toggleBtn) {
        const canvas = document.getElementById('bandChart');
        if (!canvas || !canvas.parentElement) return;
        toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggleVistaSesion';
        toggleBtn.type = 'button';
        toggleBtn.className = 'btn btn-sm btn-outline-secondary mb-2';
        canvas.parentElement.insertBefore(toggleBtn, canvas);
    }

    toggleBtn.textContent = '🔎 Ver sesión completa';
    toggleBtn.onclick = () => {
        if (viewMode === 'live') {
            setViewMode('full');
            toggleBtn.textContent = '⏱️ Volver a vista en vivo';
        } else {
            setViewMode('live');
            toggleBtn.textContent = '🔎 Ver sesión completa';
        }
    };
}

// Dibuja la línea vertical de inicio/fin de una prueba en el segundo exacto
export function dibujarMarcador(id, texto, color) {
    const segundoExacto = (Date.now() - liveState.chartStartTime) / 1000;

    bandChart.options.plugins.annotation.annotations[id] = {
        type: 'line',
        xMin: segundoExacto,
        xMax: segundoExacto,
        borderColor: color,
        borderWidth: 3,
        label: {
            display: true,
            content: `${texto} (${segundoExacto.toFixed(2)}s)`,
            position: 'start',
            backgroundColor: color,
            color: 'white',
            font: { size: 10, weight: 'bold' },
            padding: 4,
            borderRadius: 4,
            yAdjust: -10
        },
        enter(ctx) { ctx.element.options.borderWidth = 6; ctx.chart.update(); },
        leave(ctx) { ctx.element.options.borderWidth = 3; ctx.chart.update(); },
        click(ctx) { showStatusMessage(`📍 Evento: ${texto} en el segundo ${segundoExacto.toFixed(2)}`, color); }
    };
    bandChart.update();
}

// Limpia la gráfica y la deja lista para arrancar una sesión nueva
export function resetChartData() {
    chartData.theta.length = 0;
    chartData.alpha.length = 0;
    chartData.beta.length = 0;
    viewMode = 'live';
    if (bandChart) {
        bandChart.options.scales.x.min = 0;
        bandChart.options.scales.x.max = LIVE_WINDOW_SECONDS;
        bandChart.update();
    }
    if (toggleBtn) toggleBtn.textContent = 'Ver sesión completa';
}

// Borra los marcadores de inicio/fin de prueba al iniciar una nueva sesión
export function limpiarMarcadoresSesion() {
    if (bandChart && bandChart.options.plugins.annotation) {
        bandChart.options.plugins.annotation.annotations = {};
        bandChart.update();
    }
}

// Refresca el osciloscopio en cada muestra nueva
export function refreshEegChart() {
    if (eegChart) eegChart.update('none');
}

// Ajusta el 3D y las gráficas cuando cambia el tamaño de la ventana
window.addEventListener('resize', () => {
    const canvas = document.getElementById("canvas3d");
    if (canvas && camera) {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
    if (bandChart) bandChart.resize();
    if (eegChart) eegChart.resize();
});