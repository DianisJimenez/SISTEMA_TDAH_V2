import { sincronizarPaciente } from './paciente-api.js';
// Se importan por efectos secundarios: cada uno engancha sus propios listeners al cargar
import './dispositivo-conexion.js';
import './control-sesion.js';

// INICIALIZACIÓN DE LA PÁGINA
const hoy = new Date();
const opciones = { day: '2-digit', month: '2-digit', year: 'numeric' };
document.getElementById('currentDate').innerText = hoy.toLocaleDateString('es-ES', opciones);

const elFechaMini = document.getElementById('sesion-fecha-mini');
if (elFechaMini) elFechaMini.innerText = hoy.toLocaleDateString('es-ES', opciones);

const elCodigoSesion = document.getElementById('sesion-codigo');
if (elCodigoSesion) elCodigoSesion.innerText = 'Pendiente';

sincronizarPaciente();
