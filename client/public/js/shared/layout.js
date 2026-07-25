// Este script gestiona la identidad visual y funcional en todas las pantallas.

const layoutTemplate = {
    // Genera el HTML del menú lateral
    sidebar: (activeId) => `
        <div class="brand-container d-flex align-items-center justify-content-between">
            <div class="app-brand ms-3 d-flex align-items-center gap-2">
                <a href="admi.html" class="d-flex align-items-center gap-2 text-decoration-none">
                    <img src="assets/images/logoTDHA.png" class="logo-custom" alt="Logo">
                    <span class="brand-title">
                        <span class="brand-title-top">DETEC</span>
                        <span class="brand-title-bottom">TDAH</span>
                    </span>
                </a>
            </div>
            <button type="button" class="pin-sidebar me-3 text-primary border-0 bg-transparent">
                <i class="ri-menu-line"></i>
            </button>
        </div>
        <div class="sidebar-profile text-center mt-3">
            <img src="assets/images/doctor6.png" class="img-7x rounded-circle border border-3 border-primary-subtle shadow-sm img-medico-perfil">
            <h6 class="mt-2 mb-0 text-dark nombre-medico-perfil">Cargando...</h6>
            <p class="mb-0 small fw-bold text-primary id-medico-perfil">ID: #--</p>
        </div>
        <div class="sidebarMenuScroll mt-3">
            <ul class="sidebar-menu">
                <li class="${activeId === 'admi' ? 'active current-page' : ''}"><a href="admi.html"><i class="ri-home-smile-2-line"></i><span class="menu-text">Inicio</span></a></li>
                <li class="${(activeId === 'pacientesL' || activeId === 'pacientes') ? 'active current-page' : ''}"><a href="pacientes.html"><i class="ri-group-line"></i><span class="menu-text">Mis Pacientes</span></a></li>
                <li class="${activeId === 'dispositivos' ? 'active current-page' : ''}"><a href="misDispositivos.html"><i class="ri-bluetooth-line"></i><span class="menu-text">Mis Dispositivos</span></a></li>
                <li class="${activeId === 'pruebas' ? 'active current-page' : ''}"><a href="misPruebas.html"><i class="ri-flask-line"></i><span class="menu-text">Mis Pruebas</span></a></li>
            </ul>
        </div>`,

    // Genera el HTML de la barra superior (Con margen para evitar que se peguen los textos)
    header: (title, menuId) => {
        const contadorHtml = (menuId === 'pacientesL') 
            ? `<span class="count-badge ms-2">
                <i class="ri-group-line"></i>
                <span id="totalPacientes">00</span>
               </span>` 
            : '';

        // Si ya estamos en la página de perfil, no tiene sentido mostrar
        // un link "Mi Perfil" que apunte a la misma página en la que ya
        // estás.
        const miPerfilHtml = (menuId !== 'perfil')
            ? `<a class="dropdown-item d-flex align-items-center" href="perfilMedico.html">
                    <i class="ri-user-settings-line me-2 fs-5 text-primary"></i> Mi Perfil
               </a>
               <div class="dropdown-divider m-0"></div>`
            : '';

        return `
        <div class="d-flex align-items-center flex-grow-1">
            <button type="button" class="toggle-sidebar btn btn-sm d-xl-none me-3"><i class="ri-menu-line fs-4 text-primary"></i></button>
            <h5 class="mb-0 fw-bold text-dark d-flex align-items-center">
                <span class="me-1">${title}</span> ${contadorHtml}
            </h5>           
        </div>
        <div class="header-actions d-flex align-items-center gap-2 ms-3">
            <div class="dropdown">
                <a id="userSettings" class="dropdown-toggle d-flex align-items-center" href="#!" data-bs-toggle="dropdown">
                    <img src="assets/images/doctor6.png" class="rounded-circle border border-2 border-white shadow-sm img-medico-perfil" width="42" height="42">
                </a>
                <div class="dropdown-menu dropdown-menu-end shadow-sm border-0">
                    <div class="p-3 border-bottom">
                        <h6 class="mb-0 fw-bold nombre-medico-perfil">Médico</h6>
                    </div>
                    ${miPerfilHtml}
                    <a class="dropdown-item d-flex align-items-center text-danger" href="#!" id="global-logout">
                        <i class="ri-logout-box-line me-2 fs-5"></i> Cerrar Sesión
                    </a>
                </div>
            </div>
        </div>`
    }
};

function inicializarLayout(config) {
    const sidebarContainer = document.getElementById('sidebar');
    const headerContainer = document.querySelector('.app-header');

    if (sidebarContainer) sidebarContainer.innerHTML = layoutTemplate.sidebar(config.menuId);

    if (headerContainer && !config.skipHeader) {
        headerContainer.innerHTML = layoutTemplate.header(config.titulo, config.menuId);
    }

    const elFecha = document.getElementById('currentDate');
    if (elFecha) {
        const hoy = new Date();
        const opciones = { day: '2-digit', month: '2-digit', year: 'numeric' };
        elFecha.textContent = hoy.toLocaleDateString('es-ES', opciones);
    }

    const rawNombre = localStorage.getItem('medicoNombre') || "Doctora";
    const medicoId = localStorage.getItem('medicoId') || "00";
    const foto = localStorage.getItem('medicoFoto') || "assets/images/doctor6.png";

    const partes = rawNombre.trim().split(/\s+/);
    const nombreCorto = partes.length >= 3 ? `${partes[0]} ${partes[2]}` : rawNombre;

    document.querySelectorAll(".nombre-medico-perfil").forEach(el => el.textContent = `Dr. ${nombreCorto}`);
    document.querySelectorAll(".id-medico-perfil").forEach(el => el.textContent = `ID: #${medicoId}`);
    document.querySelectorAll(".img-medico-perfil").forEach(el => el.src = foto);

    $(document).off("click", ".pin-sidebar").on("click", ".pin-sidebar", () => $(".page-wrapper").toggleClass("pinned"));
    $(document).off("click", ".toggle-sidebar").on("click", ".toggle-sidebar", () => $(".page-wrapper").toggleClass("toggled"));
    
    $(document).off("click", "#global-logout").on("click", "#global-logout", function(e) {
        e.preventDefault();
        if(confirm("¿Desea cerrar su sesión ")) {
            localStorage.clear();
            window.location.href = "login.html";
        }
    });
}