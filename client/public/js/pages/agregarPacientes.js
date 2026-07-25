$(window).on('load', function() { 
    $("#loading-wrapper").fadeOut("slow"); 
});

// Formato oficial simplificado de CURP (18 caracteres)
const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
const TELEFONO_REGEX = /^\d{10}$/;

$(document).ready(function() {
    const API_BASE = ""; // ruta relativa: funciona en local y en producción
    
    // 1. VALIDACIÓN DE SEGURIDAD
    if (!localStorage.getItem('medicoId')) { 
        window.location.href = "login.html"; 
        return; 
    }

    // 2. INICIALIZAR EL LAYOUT DINÁMICO
    if (typeof inicializarLayout === "function") {
        inicializarLayout({
            menuId: 'pacientes',
            titulo: 'Nuevo <span class="text-primary">Registro</span>'
        });
    }

    const medicoId = localStorage.getItem('medicoId');

    function marcarError($input, $errorBox, mensaje) {
        $input.addClass('is-invalid-custom');
        $errorBox.text(mensaje).addClass('show');
    }

    function limpiarError($input, $errorBox) {
        $input.removeClass('is-invalid-custom');
        $errorBox.text('').removeClass('show');
    }

    // 3. CÁLCULO DE EDAD
    $('#fecha_nacimiento').on('change', function() {
        limpiarError($('#fecha_nacimiento'), $('#fechaNacimientoError'));

        const fechaNacString = $(this).val();
        if (!fechaNacString) return;

        const hoy = new Date();
        const cumpleanos = new Date(fechaNacString);
        cumpleanos.setMinutes(cumpleanos.getMinutes() + cumpleanos.getTimezoneOffset());

        // Fecha futura
        if (cumpleanos > hoy) {
            $('#edad').val('');
            marcarError($('#fecha_nacimiento'), $('#fechaNacimientoError'), 'La fecha de nacimiento no puede ser futura.');
            return;
        }

        let edad = hoy.getFullYear() - cumpleanos.getFullYear();
        const m = hoy.getMonth() - cumpleanos.getMonth();

        if (m < 0 || (m === 0 && hoy.getDate() < cumpleanos.getDate())) {
            edad--;
        }

        // Edad fuera de un rango humano razonable: también se marca como error
        if (edad < 0 || edad > 120) {
            $('#edad').val('');
            marcarError($('#fecha_nacimiento'), $('#fechaNacimientoError'), 'La fecha de nacimiento no es válida.');
            return;
        }

        $('#edad').val(edad);
    });

    // 4. RESTRICCIÓN DE ESCRITURA EN TIEMPO REAL

    // Nombre: limpia el error en cuanto empieza a escribir
    $('#nombre').on('input', function() {
        limpiarError($(this), $('#nombreError'));
    });

    // Teléfono: solo permite dígitos mientras se escribe, tope de 10
    $('#telefono').on('input', function() {
        const limpio = $(this).val().replace(/\D/g, '').slice(0, 10);
        $(this).val(limpio);
        limpiarError($(this), $('#telefonoError'));
    });

    // CURP: mayúsculas forzadas y solo letras/números, tope de 18
    $('#curp').on('input', function() {
        const limpio = $(this).val().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18);
        $(this).val(limpio);
        limpiarError($(this), $('#curpError'));
    });

    // Consentimiento: limpia el error en cuanto se marca
    $('#consentimiento').on('change', function() {
        if ($(this).is(':checked')) {
            $('#consentimientoError').text('').removeClass('show');
        }
    });

    // 5. REGISTRO
    $('#formRegistro').on('submit', async function(e) {
        e.preventDefault();

        const nombre = $('#nombre').val().trim();
        const fechaNacimiento = $('#fecha_nacimiento').val();
        const edad = $('#edad').val();
        const telefono = $('#telefono').val().trim();
        const curp = $('#curp').val().trim();
        const consentimiento = $('#consentimiento').is(':checked');
        let formularioValido = true;

        // Nombre obligatorio
        if (nombre === '') {
            marcarError($('#nombre'), $('#nombreError'), 'El nombre es obligatorio.');
            formularioValido = false;
        } else {
            limpiarError($('#nombre'), $('#nombreError'));
        }

        // Fecha de nacimiento obligatoria (de esto depende la edad)
        if (fechaNacimiento === '' || edad === '') {
            marcarError($('#fecha_nacimiento'), $('#fechaNacimientoError'), 'La fecha de nacimiento es obligatoria.');
            formularioValido = false;
        } else {
            const hoy = new Date();
            const cumpleanos = new Date(fechaNacimiento);
            cumpleanos.setMinutes(cumpleanos.getMinutes() + cumpleanos.getTimezoneOffset());
            const edadNum = parseInt(edad, 10);

            if (cumpleanos > hoy) {
                marcarError($('#fecha_nacimiento'), $('#fechaNacimientoError'), 'La fecha de nacimiento no puede ser futura.');
                formularioValido = false;
            } else if (isNaN(edadNum) || edadNum < 0 || edadNum > 120) {
                marcarError($('#fecha_nacimiento'), $('#fechaNacimientoError'), 'La fecha de nacimiento no es válida.');
                formularioValido = false;
            } else {
                limpiarError($('#fecha_nacimiento'), $('#fechaNacimientoError'));
            }
        }

        // Consentimiento obligatorio
        if (!consentimiento) {
            $('#consentimientoError').text('Debes aceptar el consentimiento informado.').addClass('show');
            formularioValido = false;
        } else {
            $('#consentimientoError').text('').removeClass('show');
        }

        // Teléfono es opcional, pero si lo llenan debe tener 10 dígitos exactos
        if (telefono !== '' && !TELEFONO_REGEX.test(telefono)) {
            marcarError($('#telefono'), $('#telefonoError'), 'El teléfono debe tener exactamente 10 dígitos.');
            formularioValido = false;
        } else {
            limpiarError($('#telefono'), $('#telefonoError'));
        }

        // CURP es opcional, pero si la llenan debe cumplir el formato oficial
        if (curp !== '' && !CURP_REGEX.test(curp)) {
            marcarError($('#curp'), $('#curpError'), 'La CURP no tiene un formato válido (18 caracteres).');
            formularioValido = false;
        } else {
            limpiarError($('#curp'), $('#curpError'));
        }

        if (!formularioValido) {
            return;
        }

        const datos = {
            nombre: nombre,
            edad: edad,
            sexo: $('#sexo').val(),
            curp: curp,
            telefono: telefono,
            fecha_nacimiento: fechaNacimiento,
            tipo_sangre: $('#tipo_sangre').val(),
            medico_id: medicoId 
        };

        try {
            const response = await fetch(`${API_BASE}/api/registrar-paciente`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });

            const result = await response.json();
            if (result.success) {
                alert("¡Registro exitoso!");
                window.location.href = "pacientes.html";
            } else {
                alert("Error: " + result.error);
            }
        } catch (error) {
            alert("Error en el servidor.");
        }
    });
});