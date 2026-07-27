const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');

// Cache de sesiones del historial: la llena historial-sesiones.js y la leen historial-sesiones.js y reportes-sesion.js
let cacheSesiones = [];

if (!id) {
    window.location.href = "pacientes.html";
}

// INICIALIZAR EL LAYOUT DINÁMICO
if (typeof inicializarLayout === "function") {
    inicializarLayout({
        menuId: 'pacientes',
        titulo: 'Administración del <span class="text-primary">Paciente</span>'
    });
}

function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return 0;
    const hoy = new Date();
    const cumple = new Date(fechaNacimiento);
    if (isNaN(cumple.getTime()) || cumple > hoy) return null; // fecha inválida o futura
    let edad = hoy.getFullYear() - cumple.getFullYear();
    const m = hoy.getMonth() - cumple.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) { edad--; }
    return (edad > 120) ? null : edad;
}

// Clona un <template> y regresa su nodo raíz ya en el DOM (no el DocumentFragment) para poder usar querySelector
function clonarPlantilla(idPlantilla) {
    const frag = document.getElementById(idPlantilla).content.cloneNode(true);
    return frag.firstElementChild;
}

function mostrarVacio(contenedor, mensaje) {
    contenedor.innerHTML = `<div class="col-12 text-center text-muted p-3 border rounded-3 bg-light"><small>${mensaje}</small></div>`;
}

async function cargarMedicosSelect(medicoIdActual) {
    try {
        const res = await fetch(`/api/medicos`);
        const medicos = await res.json();
        let html = '<option value="">Seleccione un médico...</option>';
        medicos.forEach(m => {
            const selected = (m.id == medicoIdActual) ? 'selected' : '';
            html += `<option value="${m.id}" ${selected}>${m.nombre}</option>`;
            if (m.id == medicoIdActual) { $('#infoDoctor').text(m.nombre); }
        });
        $('#editMedico').html(html);
    } catch (e) {
        console.error("Error médicos:", e);
    }
}

async function cargarPaciente() {
    try {
        // Pedimos las 3 cosas en paralelo: paciente, dispositivos y pruebas
        const [resP, resD, resPruebas] = await Promise.all([
            fetch(`/api/pacientes/${id}`),
            fetch(`/api/dispositivos`),
            fetch(`/api/pruebas`)
        ]);

        if (!resP.ok) throw new Error("Paciente no encontrado");
        const p = await resP.json();
        const todosLosDispositivos = await resD.json();

        // dispositivo_id es un solo valor (o null) en la BD, ya no una lista separada por comas
        let dispositivosAsignados = [];
        if (p.dispositivo_id) {
            dispositivosAsignados = [p.dispositivo_id.toString()];
        }

        $('#nombreHeaderTitulo, #infoNombre').text(p.nombre);
        $('#idPacienteHeader').text(`#${p.id}`);
        $('#infoEdad').text(`${p.edad} años`);
        $('#infoSexo').text(p.sexo);
        $('#infoSangre').text(p.tipo_sangre || 'N/A');
        $('#infoCurp').text(p.curp || '---');
        $('#infoTelefono').text(p.telefono || '---');

        if (p.fecha_nacimiento) {
            const fechaISO = p.fecha_nacimiento.split('T')[0];
            $('#editFecha').val(fechaISO);
            $('#infoFecha').text(fechaISO.split('-').reverse().join('/'));
        }

        // --- LÓGICA DE DISPOSITIVOS ---
        const dropdownDispositivos = document.getElementById('itemsDispositivosDisponibles');
        const cardsArriba = document.getElementById('contenedorChecksDinamicos');
        const cardsAbajo = document.getElementById('contenedorDispositivosCuerpo');

        dropdownDispositivos.innerHTML = '';
        cardsArriba.innerHTML = '';
        let hayAsignado = false;

        todosLosDispositivos.forEach(dev => {
            const estaVinculado = dispositivosAsignados.includes(dev.id.toString());
            const imgUrl = dev.foto_url ? `/${dev.foto_url}` : 'assets/images/device-default.png';

            // Ítem del dropdown del botón (+): es un RADIO para que solo se elija UNO
            const itemDropdown = clonarPlantilla('tplItemDropdownDispositivo');
            const inputRadio = itemDropdown.querySelector('.check-dispositivo-dinamico');
            const labelRadio = itemDropdown.querySelector('.campo-nombre');
            inputRadio.value = dev.id;
            inputRadio.id = `drop_${dev.id}`;
            inputRadio.checked = estaVinculado;
            labelRadio.setAttribute('for', `drop_${dev.id}`);
            labelRadio.textContent = dev.nombre;
            dropdownDispositivos.appendChild(itemDropdown);

            if (estaVinculado) {
                hayAsignado = true;

                // Tarjeta pequeña para "Dispositivos Asignados" (arriba)
                const cardArriba = clonarPlantilla('tplCardDispositivoAsignado');
                cardArriba.querySelector('.campo-foto').src = imgUrl;
                cardArriba.querySelector('.campo-nombre').textContent = dev.nombre;
                cardsArriba.appendChild(cardArriba);

                // Botón grande para "Sesiones Disponibles" (abajo)
                if (cardsAbajo) {
                    const cardAbajo = clonarPlantilla('tplCardDispositivoSesion');
                    cardAbajo.querySelector('.campo-foto').src = imgUrl;
                    cardAbajo.querySelector('.campo-nombre').textContent = dev.nombre;
                    cardsAbajo.appendChild(cardAbajo);
                }
            }
        });

        if (!hayAsignado) {
            mostrarVacio(cardsArriba, 'No hay dispositivos vinculados.');
            if (cardsAbajo) cardsAbajo.innerHTML = '<div class="col-12 text-center text-muted p-4">Asigna un dispositivo para iniciar sesión.</div>';
        }

        // --- LÓGICA DE PRUEBAS ---
        const todasLasPruebas = await resPruebas.json();
        // Las pruebas asignadas vienen como arreglo de ids en p.pruebas_ids
        let pruebasAsignadas = (p.pruebas_ids || []).map(x => x.toString());

        const dropdownPruebas = document.getElementById('itemsPruebasDisponibles');
        const cardsPruebas = document.getElementById('contenedorPruebasDinamicas');
        dropdownPruebas.innerHTML = '';
        cardsPruebas.innerHTML = '';
        let hayPruebaAsignada = false;

        todasLasPruebas.forEach(prub => {
            const vinculada = pruebasAsignadas.includes(prub.id.toString());

            const itemDropdown = clonarPlantilla('tplItemDropdownPrueba');
            const inputCheck = itemDropdown.querySelector('.check-prueba-dinamica');
            const labelCheck = itemDropdown.querySelector('.campo-nombre');
            inputCheck.value = prub.id;
            inputCheck.id = `prub_${prub.id}`;
            inputCheck.checked = vinculada;
            labelCheck.setAttribute('for', `prub_${prub.id}`);
            labelCheck.textContent = prub.nombre;
            dropdownPruebas.appendChild(itemDropdown);

            if (vinculada) {
                hayPruebaAsignada = true;
                const card = clonarPlantilla('tplCardPruebaAsignada');
                card.querySelector('.campo-nombre').textContent = prub.nombre;
                cardsPruebas.appendChild(card);
            }
        });

        if (!hayPruebaAsignada) {
            mostrarVacio(cardsPruebas, 'No hay pruebas asignadas.');
        }

        $('#editNombre').val(p.nombre);
        $('#editSexo').val(p.sexo);
        $('#editSangre').val(p.tipo_sangre);
        $('#editCurp').val(p.curp);
        $('#editTelefono').val(p.telefono);

        if (p.foto_url) { $('#fotoPaciente').attr('src', `/${p.foto_url}`); }
        await cargarMedicosSelect(p.medico_id);

    } catch (e) { console.error("Error:", e); }
}

async function guardarTodo(mostrarAlerta = true) {
    const fechaVal = $('#editFecha').val();
    const edadCalculada = calcularEdad(fechaVal);

    // Si hay fecha capturada pero resulta futura o fuera de rango, no se guarda
    if (fechaVal && edadCalculada === null) {
        $('#editFecha').addClass('is-invalid');
        $('#editFechaError').text('La fecha de nacimiento no es válida (no puede ser futura).').removeClass('d-none');
        if (mostrarAlerta) alert("Revisa la fecha de nacimiento: no puede ser futura.");
        return;
    }
    $('#editFecha').removeClass('is-invalid');
    $('#editFechaError').addClass('d-none');

    let idsSeleccionados = [];
    $('.check-dispositivo-dinamico:checked').each(function () { idsSeleccionados.push($(this).val()); });

    const datos = {
        nombre: $('#editNombre').val(),
        edad: edadCalculada,
        sexo: $('#editSexo').val(),
        curp: $('#editCurp').val().toUpperCase(),
        telefono: $('#editTelefono').val(),
        fecha_nacimiento: fechaVal || null,
        tipo_sangre: $('#editSangre').val(),
        medico_id: $('#editMedico').val() || null,
        // dispositivo_id es radio button: como máximo un valor en idsSeleccionados, no una lista con comas
        dispositivo_id: idsSeleccionados[0] || null,
        // prueba_id ya no se manda aquí: se guarda aparte con /api/pacientes/:id/asignar-pruebas
    };

    try {
        const res = await fetch(`/api/pacientes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        if (res.ok) {
            if (mostrarAlerta) {
                alert("Actualizado correctamente.");
                location.reload();
            } else {
                cargarPaciente();
            }
        } else {
            const result = await res.json().catch(() => ({}));
            if (mostrarAlerta) alert("Error: " + (result.error || "No se pudo guardar."));
            console.error("Error al guardar paciente:", result.error);
        }
    } catch (e) {
        if (mostrarAlerta) alert("Error al guardar.");
    }
}

function actualizarTarjetasPruebasManual() {
    const cardsPruebas = document.getElementById('contenedorPruebasDinamicas');
    cardsPruebas.innerHTML = '';
    const seleccionadas = document.querySelectorAll('.check-prueba-dinamica:checked');

    seleccionadas.forEach(input => {
        const nombre = input.closest('.form-check').querySelector('label').textContent.trim();
        const card = clonarPlantilla('tplCardPruebaAsignada');
        card.querySelector('.campo-nombre').textContent = nombre;
        cardsPruebas.appendChild(card);
    });

    if (seleccionadas.length === 0) {
        mostrarVacio(cardsPruebas, 'No hay pruebas asignadas.');
    }
}

$(document).ready(function () {

    // Tope máximo seleccionable en el date picker
    $('#editFecha').attr('max', new Date().toISOString().split('T')[0]);
    $('#editFecha').on('change input', function () {
        $(this).removeClass('is-invalid');
        $('#editFechaError').addClass('d-none');
    });

    $('#btnLogoutSidebar').on('click', function (e) {
        e.preventDefault();
        localStorage.clear();
        window.location.href = "login.html";
    });

    // --- GUARDADO AUTOMÁTICO DE DISPOSITIVOS ---
    $(document).on('change', '.check-dispositivo-dinamico', function () {
        guardarTodo(false);
    });

    // --- GUARDADO AUTOMÁTICO DE PRUEBAS ---
    $(document).on('click', '.check-prueba-dinamica', async function (e) {
        e.stopPropagation();

        let pruebasSeleccionadas = [];
        $('.check-prueba-dinamica:checked').each(function () {
            pruebasSeleccionadas.push($(this).val());
        });

        const prueba_id_string = pruebasSeleccionadas.join(',');

        try {
            const res = await fetch(`/api/pacientes/${id}/asignar-pruebas`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prueba_id: prueba_id_string })
            });

            if (res.ok) {
                console.log("Pruebas actualizadas en DB:", prueba_id_string);
                actualizarTarjetasPruebasManual();
            }
        } catch (e) {
            console.error("Error al guardar prueba:", e);
        }
    });

    // --- GUARDADO MANUAL (BOTÓN DEL MODAL) ---
    $('#btnGuardar').on('click', function () {
        guardarTodo(true);
    });

    // --- SUBIR FOTO ---
    $('#inputFoto').on('change', async function () {
        if (!this.files[0]) return;
        const formData = new FormData();
        formData.append('foto', this.files[0]);
        formData.append('id', id);
        try {
            const res = await fetch(`/api/pacientes/subir-foto`, { method: 'POST', body: formData });
            const result = await res.json();
            if (result.success) { $('#fotoPaciente').attr('src', `/${result.foto_url}`); }
        } catch (e) { console.error(e); }
    });

    // --- CARGA INICIAL ---
    cargarPaciente();
    cargarHistorialSesiones();
    obtenerUltimoResultadoIA();

    // --- LÓGICA DEL BOTÓN INICIAR SESIÓN ---
    $('#btnIniciarSesion').on('click', function () {
        const dispositivoId = $('.check-dispositivo-dinamico:checked').val();

        let pruebasIds = [];
        $('.check-prueba-dinamica:checked').each(function () {
            pruebasIds.push($(this).val());
        });

        if (!dispositivoId) {
            alert("Debes asignar un dispositivo Muse antes de iniciar la sesión.");
            return;
        }

        // Se exige exactamente 4 pruebas seleccionadas para poder iniciar la sesión
        const PRUEBAS_REQUERIDAS = 4;
        if (pruebasIds.length !== PRUEBAS_REQUERIDAS) {
            alert(`Debes seleccionar ${PRUEBAS_REQUERIDAS} pruebas para iniciar la sesión (tienes ${pruebasIds.length} seleccionadas`);
            return;
        }

        const urlDestino = `iniciarSesion.html?id=${id}&dev=${dispositivoId}&pruebas=${pruebasIds.join(',')}`;
        console.log("Iniciando sesión DETEC TDAH", urlDestino);
        window.location.href = urlDestino;
    });
});