import { API_BASE, idPacienteURL, idMuseURL } from './state.js';

// Pruebas asignadas al paciente (primero se lee de la URL, luego se confirma con la BD)
const urlParams = new URLSearchParams(window.location.search);
let pruebasAsignadasURL = urlParams.get('pruebas') ? urlParams.get('pruebas').split(',') : [];

const elTotalPruebasInit = document.getElementById('sesion-total-pruebas');
if (elTotalPruebasInit) elTotalPruebasInit.innerText = pruebasAsignadasURL.length;

// Pinta los chips de "Pruebas a realizar" en la ficha de la sesión
export async function pintarPruebasAsignadas() {
    const cont = document.getElementById("sesion-lista-pruebas");
    if (!cont) return;

    if (!pruebasAsignadasURL.length) {
        cont.innerHTML = '<span class="prueba-chip text-muted">Sin pruebas asignadas</span>';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/pruebas`);
        const pruebas = await res.json();
        const asignadas = pruebas.filter(p => pruebasAsignadasURL.includes(p.id.toString()));

        if (!asignadas.length) {
            cont.innerHTML = '<span class="prueba-chip text-muted">Sin pruebas asignadas</span>';
            return;
        }

        // Se usa textContent (no innerHTML) para evitar inyección de HTML/JS
        cont.innerHTML = '';
        asignadas.forEach(p => {
            const chip = document.createElement('span');
            chip.className = 'prueba-chip';
            chip.textContent = p.nombre;
            cont.appendChild(chip);
        });

        const elTotalPruebas = document.getElementById('sesion-total-pruebas');
        if (elTotalPruebas) elTotalPruebas.innerText = asignadas.length;
    } catch (e) {
        console.error("Error cargando pruebas asignadas:", e);
        cont.innerHTML = '<span class="prueba-chip text-muted">Error al cargar</span>';
    }
}

// Llena el selector de pruebas (solo con las asignadas a este paciente)
export async function cargarCatalogoPruebas() {
    try {
        const res = await fetch(`${API_BASE}/api/pruebas`);
        const pruebas = await res.json();
        const select = document.getElementById("pruebaCatalogo");
        if (!select) return;

        select.innerHTML = '<option value="">-- Seleccione una prueba --</option>';
        pruebas.forEach(p => {
            if (pruebasAsignadasURL.includes(p.id.toString())) {
                const option = document.createElement("option");
                option.value = p.nombre;
                option.textContent = p.nombre;
                select.appendChild(option);
            }
        });
    } catch (e) {
        console.error("Error cargando catálogo:", e);
    }
}

// Trae los datos reales del paciente desde el backend y llena la ficha
export async function sincronizarPaciente() {
    if (!idPacienteURL) return;

    const nombreElem = document.getElementById("sesion-nombre");
    if (!nombreElem) return;

    try {
        const response = await fetch(`${API_BASE}/api/pacientes/${idPacienteURL}`);
        if (!response.ok) return;
        const p = await response.json();

        nombreElem.innerText = p.nombre;
        if (document.getElementById("sesion-id")) document.getElementById("sesion-id").innerText = `#${p.id}`;
        if (document.getElementById("sesion-edad")) document.getElementById("sesion-edad").innerText = `${p.edad} años`;

        // p.pruebas_ids es la fuente de verdad real (no la URL, que puede estar vieja)
        if (Array.isArray(p.pruebas_ids)) {
            pruebasAsignadasURL = p.pruebas_ids.map(id => id.toString());
            pintarPruebasAsignadas();
            cargarCatalogoPruebas();
            const elTotalPruebas = document.getElementById('sesion-total-pruebas');
            if (elTotalPruebas) elTotalPruebas.innerText = pruebasAsignadasURL.length;
        }

        // Trae el último diagnóstico del paciente
        const badgeDiagnostico = document.getElementById("sesion-diagnostico");
        if (badgeDiagnostico) {
            try {
                const resDiag = await fetch(`${API_BASE}/api/ultimo-resultado/${idPacienteURL}`);
                const dataDiag = await resDiag.json();
                badgeDiagnostico.innerText = dataDiag.diagnostico || 'Sin diagnóstico';
            } catch (e) {
                badgeDiagnostico.innerText = 'Sin diagnóstico';
            }
        }

        const fotoElem = document.getElementById("sesion-foto");
        if (p.foto_url && fotoElem) {
            fotoElem.src = `${API_BASE}/${p.foto_url}`;
        }

        // Muestra el nombre del dispositivo Muse asignado
        if (idMuseURL) {
            const resDev = await fetch(`${API_BASE}/api/dispositivos`);
            const dispositivos = await resDev.json();
            const miMuse = dispositivos.find(d => d.id == idMuseURL);
            if (miMuse && document.getElementById("muse-asignado-nombre")) {
                document.getElementById("muse-asignado-nombre").innerText = miMuse.nombre;
            }
        }
    } catch (error) {
        console.error("Error en sincronización:", error);
    }
}