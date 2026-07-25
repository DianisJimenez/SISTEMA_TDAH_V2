// Sesión que está siendo editada en el modal de pronóstico (se guarda al
// abrir el modal con el ícono de cerebro, y se usa cuando se le da a
// "Guardar pronóstico").
let sesionEnEdicionPronostico = null;

function pintarBadgeDiagnostico(span, diagnostico) {
    span.textContent = diagnostico || 'Sin diagnóstico';
    span.className = 'badge campo-badge-diagnostico'; // reset de clases previas
    if (diagnostico === 'TDAH Detectado') {
        span.classList.add('bg-danger-subtle', 'text-danger');
    } else if (diagnostico === 'Sin TDAH') {
        span.classList.add('bg-success-subtle', 'text-success');
    } else {
        span.classList.add('bg-secondary-subtle', 'text-secondary');
    }
}

async function cargarHistorialSesiones() {
    try {
        const res = await fetch(`/api/historial-paciente/${id}`);
        cacheSesiones = await res.json();
        const tbody = document.getElementById('tablaSesionesBody');
        tbody.innerHTML = '';

        if (cacheSesiones.length === 0) {
            const vacio = document.getElementById('tplFilaSesionVacia').content.cloneNode(true);
            tbody.appendChild(vacio);
            return;
        }

        cacheSesiones.forEach((s, i) => {
            const fila = document.getElementById('tplFilaSesion').content.cloneNode(true);

            const f = new Date(s.fecha_hora);
            const fecha = f.toLocaleDateString() + ' ' + f.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const segundos = Math.round(s.duracion_total_seg);
            const nombreEquipo = s.nombre_dispositivo || "No registrado";

            fila.querySelector('.campo-id').textContent = `#${s.id_sesion}`;
            fila.querySelector('.campo-fecha').textContent = fecha;
            fila.querySelector('.campo-dispositivo').textContent = nombreEquipo;
            fila.querySelector('.campo-duracion').textContent = `${segundos} seg`;
            fila.querySelector('.campo-total-pruebas').textContent = `${s.total_pruebas} pruebas`;

            // Si nunca se ha hecho un pronóstico, s.diagnostico debe llegar
            // como "Sin diagnóstico" (así lo guarda el backend por defecto).
            pintarBadgeDiagnostico(fila.querySelector('.campo-badge-diagnostico'), s.diagnostico);

            fila.querySelector('.btn-ver-resumen').addEventListener('click', () => verResumen(i));
            fila.querySelector('.btn-eliminar-sesion').addEventListener('click', () => confirmarEliminarSesion(s.id_sesion));
            fila.querySelector('.btn-realizar-pronostico').addEventListener('click', () => abrirModalPronostico(s));

            tbody.appendChild(fila);
        });

    } catch (e) {
        console.error("Error historial:", e);
    }
}

// Abre el modal de pronóstico precargado con el valor actual de la sesión
// (si ya tenía uno) y deja marcada esa sesión como la que se va a editar.
function abrirModalPronostico(sesion) {
    sesionEnEdicionPronostico = sesion;
    document.getElementById('idSesionPronostico').textContent = `#${sesion.id_sesion}`;

    const checkSinTDAH = document.getElementById('checkSinTDAH');
    const checkTDAHDetectado = document.getElementById('checkTDAHDetectado');
    checkSinTDAH.checked = sesion.diagnostico === 'Sin TDAH';
    checkTDAHDetectado.checked = sesion.diagnostico === 'TDAH Detectado';

    const modal = new bootstrap.Modal(document.getElementById('modalPronostico'));
    modal.show();
}

// Los dos checkboxes del modal son mutuamente excluyentes: solo uno de los
// dos puede quedar marcado (no puede ser "Sin TDAH" y "TDAH Detectado" a
// la vez). Si no se marca ninguno, al guardar queda "Sin diagnóstico"
document.getElementById('checkSinTDAH').addEventListener('change', function () {
    if (this.checked) document.getElementById('checkTDAHDetectado').checked = false;
});
document.getElementById('checkTDAHDetectado').addEventListener('change', function () {
    if (this.checked) document.getElementById('checkSinTDAH').checked = false;
});

document.getElementById('btnGuardarPronostico').addEventListener('click', async () => {
    if (!sesionEnEdicionPronostico) return;

    const checkSinTDAH = document.getElementById('checkSinTDAH').checked;
    const checkTDAHDetectado = document.getElementById('checkTDAHDetectado').checked;

    // Si no se marcó ningún checkbox, el pronóstico vuelve a "Sin diagnóstico"
    let diagnostico = 'Sin diagnóstico';
    if (checkSinTDAH) diagnostico = 'Sin TDAH';
    else if (checkTDAHDetectado) diagnostico = 'TDAH Detectado';

    await guardarDiagnosticoSesion(sesionEnEdicionPronostico, diagnostico);

    // Refresca el badge de esa fila sin recargar toda la tabla
    const fila = [...document.querySelectorAll('#tablaSesionesBody tr')]
        .find(tr => tr.querySelector('.campo-id')?.textContent === `#${sesionEnEdicionPronostico.id_sesion}`);
    if (fila) pintarBadgeDiagnostico(fila.querySelector('.campo-badge-diagnostico'), diagnostico);

    bootstrap.Modal.getInstance(document.getElementById('modalPronostico')).hide();
    sesionEnEdicionPronostico = null;
});

// Guarda el diagnóstico de una sesión específica (lo pone el médico a mano
// por ahora). No recarga toda la tabla, solo avisa si algo falló.
async function guardarDiagnosticoSesion(sesion, diagnostico) {
    try {
        const res = await fetch(`/api/sesiones/${sesion.id_sesion}/diagnostico`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ diagnostico })
        });
        const data = await res.json();
        if (!data.success) {
            alert('No se pudo guardar el diagnóstico: ' + (data.error || 'error desconocido'));
            return;
        }

        // Sincroniza la caché en memoria con lo que ya quedó guardado en la BD
        sesion.diagnostico = diagnostico;

        // Refrescamos el resumen de "último resultado" del paciente,
        // por si esta era su sesión más reciente
        obtenerUltimoResultadoIA();
    } catch (e) {
        console.error("Error al guardar diagnóstico:", e);
        alert('Error de conexión al guardar el diagnóstico.');
    }
}

async function confirmarEliminarSesion(idSesion) {
    if (!confirm('¿Estás segura de que deseas eliminar esta sesión?')) return;

    try {
        const res = await fetch(`/api/sesiones/${idSesion}`, {
            method: 'DELETE'
        });
        const data = await res.json();

        if (data.success) {
            cargarHistorialSesiones();
            console.log("Sesión #" + idSesion + " eliminada.");
        } else {
            console.error("Error al borrar:", data.error);
        }
    } catch (e) {
        console.error("Error de conexión:", e);
    }
}

async function obtenerUltimoResultadoIA() {
    try {
        if (!id) return;

        const respuesta = await fetch(`/api/ultimo-resultado/${id}`);
        const data = await respuesta.json();

        if (data && data.diagnostico) {
            $('#resSimple').text(data.diagnostico);

            if (data.diagnostico === "TDAH Detectado") {
                $('#resSimple').css('color', '#e74c3c').css('font-weight', 'bold');
            } else {
                $('#resSimple').css('color', '#2bb2ba').css('font-weight', 'bold');
            }
        } else {
            $('#resSimple').text('Sin sesiones registradas');
        }
    } catch (error) {
        console.error("Error al cargar diagnóstico:", error);
        $('#resSimple').text('Error de conexión');
    }
}