(function() {
    let chartLineaInstancia = null;
    let ultimosDatosGraficas = null;

    const inicializarDashboard = () => {
        if (window.jQuery) {
            const $ = window.jQuery;

            if (typeof inicializarLayout === "function") {
                inicializarLayout({
                    menuId: 'admi', 
                    titulo: 'Panel de <span class="text-primary">Administración</span>'
                });
            }

            $(window).on('load', function() { 
                $("#loading-wrapper").fadeOut("slow"); 
            });

            $(document).ready(function() {
                const medicoId = localStorage.getItem('medicoId');

                if (!medicoId) { 
                    window.location.href = "login.html";
                    return; 
                }

                function leerColorAcento() {
                    const valor = getComputedStyle(document.documentElement)
                        .getPropertyValue('--accent-color').trim();
                    return valor || '#2bb2ba';
                }

                function resolverARgb(colorCss) {
                    const temp = document.createElement('div');
                    temp.style.color = colorCss;
                    document.body.appendChild(temp);
                    const rgb = getComputedStyle(temp).color;
                    document.body.removeChild(temp);
                    return rgb;
                }

                function parsearRgb(rgbStr) {
                    const numeros = rgbStr.match(/\d+/g).map(Number);
                    return { r: numeros[0], g: numeros[1], b: numeros[2] };
                }

                function rgbAHsl(r, g, b) {
                    r /= 255; g /= 255; b /= 255;
                    const max = Math.max(r, g, b), min = Math.min(r, g, b);
                    let h, s, l = (max + min) / 2;
                    if (max === min) {
                        h = s = 0;
                    } else {
                        const d = max - min;
                        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                        switch (max) {
                            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                            case g: h = (b - r) / d + 2; break;
                            case b: h = (r - g) / d + 4; break;
                        }
                        h /= 6;
                    }
                    return { h: h * 360, s: s * 100, l: l * 100 };
                }

                function hslATexto(h, s, l, alpha = 1) {
                    h = ((h % 360) + 360) % 360;
                    return alpha === 1
                        ? `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`
                        : `hsla(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%, ${alpha})`;
                }

                function generarPaletaDesdeAcento(colorBase, cantidad) {
                    const rgb = parsearRgb(resolverARgb(colorBase));
                    const hsl = rgbAHsl(rgb.r, rgb.g, rgb.b);
                    const saturacion = Math.max(hsl.s, 45);
                    const luminosidad = Math.min(Math.max(hsl.l, 40), 58);
                    const paso = 360 / Math.max(cantidad, 1) / 1.6;

                    const paleta = [];
                    for (let i = 0; i < cantidad; i++) {
                        const desplazamiento = (i - (cantidad - 1) / 2) * paso;
                        paleta.push(hslATexto(hsl.h + desplazamiento, saturacion, luminosidad));
                    }
                    return paleta;
                }

                function colorPorDiagnostico(diagnostico) {
                    const mapaColores = {
                        'Sin diagnóstico': '#3b82f6',
                        'Sin TDAH': '#22c55e',
                        'TDAH Detectado': '#ef4444'
                    };
                    return mapaColores[diagnostico] || '#9ca3af';
                }

                function crearOActualizarGraficaLinea(data) {
                    const elLinea = document.getElementById('chartEvolucionDLC');
                    if (!elLinea) return;
                    const ctxLinea = elLinea.getContext('2d');
                    const colorAcento = leerColorAcento();
                    const colorAcentoRgb = resolverARgb(colorAcento);

                    const gradienteLinea = ctxLinea.createLinearGradient(0, 0, 0, 240);
                    gradienteLinea.addColorStop(0, colorAcentoRgb.replace('rgb', 'rgba').replace(')', ', 0.35)'));
                    gradienteLinea.addColorStop(1, colorAcentoRgb.replace('rgb', 'rgba').replace(')', ', 0)'));

                    if (chartLineaInstancia) {
                        chartLineaInstancia.destroy();
                    }

                    chartLineaInstancia = new Chart(ctxLinea, {
                        type: 'line',
                        data: {
                            labels: data.linea.map(item => item.dia),
                            datasets: [{
                                label: 'Flujo de Pacientes',
                                data: data.linea.map(item => item.total),
                                borderColor: colorAcentoRgb,
                                backgroundColor: gradienteLinea,
                                fill: true,
                                tension: 0.35,
                                borderWidth: 3,
                                pointRadius: 3,
                                pointHoverRadius: 6,
                                pointBackgroundColor: '#fff',
                                pointBorderColor: colorAcentoRgb,
                                pointBorderWidth: 2
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: { mode: 'index', intersect: false },
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: '#1a1a2e',
                                    padding: 10,
                                    cornerRadius: 8,
                                    displayColors: false,
                                    callbacks: {
                                        label: (ctx) => ` ${ctx.raw} paciente${ctx.raw === 1 ? '' : 's'}`
                                    }
                                }
                            },
                            scales: {
                                x: { grid: { display: false }, ticks: { maxTicksLimit: 7 } },
                                y: {
                                    beginAtZero: true,
                                    ticks: { stepSize: 1, precision: 0 },
                                    grid: { color: 'rgba(0,0,0,0.05)' }
                                }
                            }
                        }
                    });
                }

                async function cargarGraficasClinicas() {
                    const elDona = document.getElementById('chartComparativaDLC');

                    try {
                        const response = await fetch(`/api/stats-admin/medico/${medicoId}`);
                        if (!response.ok) throw new Error("Fallo al obtener estadísticas");
                        
                        const data = await response.json();
                        ultimosDatosGraficas = data;

                        crearOActualizarGraficaLinea(data);

                        const ctxDona = elDona.getContext('2d');
                        const totalDona = data.dona.reduce((acc, item) => acc + item.cantidad, 0);
                        const elCentroTotal = document.getElementById('donaCentroTotal');
                        if (elCentroTotal) elCentroTotal.textContent = totalDona;

                        new Chart(ctxDona, {
                            type: 'doughnut',
                            data: {
                                labels: data.dona.map(item => item.diagnostico || 'Sin diagnóstico'),
                                datasets: [{
                                    data: data.dona.map(item => item.cantidad),
                                    backgroundColor: data.dona.map(item => colorPorDiagnostico(item.diagnostico || 'Sin diagnóstico')),
                                    borderWidth: 3,
                                    borderColor: '#ffffff',
                                    hoverBorderColor: "rgba(234, 236, 244, 1)",
                                    hoverOffset: 6
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                cutout: '75%',
                                plugins: {
                                    legend: {
                                        position: 'bottom',
                                        labels: { boxWidth: 10, padding: 16, usePointStyle: true, pointStyle: 'circle' }
                                    },
                                    tooltip: {
                                        backgroundColor: '#1a1a2e',
                                        padding: 10,
                                        cornerRadius: 8,
                                        callbacks: {
                                            label: (ctx) => {
                                                const pct = totalDona ? ((ctx.raw / totalDona) * 100).toFixed(0) : 0;
                                                return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
                                            }
                                        }
                                    }
                                }
                            }
                        });

                    } catch (error) {
                        console.error("Error al cargar gráficas clínicas:", error);
                    }
                }

                async function cargarDispositivosInicio() {
                    try {
                        const response = await fetch('/api/dispositivos');
                        if (!response.ok) throw new Error("Fallo al obtener dispositivos");
                        
                        const dispositivos = await response.json();
                        let html = "";
                        dispositivos.forEach(d => {
                            const imgHtml = d.foto_url
                                ? `<img src="/${d.foto_url}" onerror="this.replaceWith(Object.assign(document.createElement('i'), {className:'ri-bluetooth-line device-img-fallback'}))" alt="${d.nombre}">`
                                : `<i class="ri-bluetooth-line device-img-fallback"></i>`;

                            html += `
                                <div class="col-md-4">
                                  <div class="card device-card-clinical shadow-sm border-0">
                                    <div class="card-body d-flex align-items-center p-3">
                                      <div class="device-img-container me-3">
                                          ${imgHtml}
                                      </div>
                                      <div class="flex-grow-1">
                                        <h6 class="mb-0 fw-bold">${d.nombre}</h6>
                                      </div>
                                    </div>
                                  </div>
                                </div>`;
                        });
                        $('#contenedorDispositivosInicio').html(html || '<div class="col-12 text-center text-muted py-3">No hay dispositivos.</div>');
                    } catch (error) { 
                        console.error("Error dispositivos:", error); 
                    }
                }

                async function cargarDashboard() {
                    try {
                        const response = await fetch(`/api/pacientes/medico/${medicoId}`);
                        if (!response.ok) throw new Error("Fallo al obtener pacientes");
                        
                        const pacientes = await response.json();
                        const recientes = pacientes.sort((a, b) => b.id - a.id).slice(0, 5);
                        
                        let html = "";
                        recientes.forEach(p => {
                            const rutaFoto = p.foto_url ? `/${p.foto_url}` : 'assets/images/user.png'; 
                            const esEnSesion = p.estado === 'En Sesión';
                            const colorClase = esEnSesion ? 'bg-success' : 'bg-secondary';
                            const icono = esEnSesion ? 'ri-checkbox-circle-fill' : 'ri-time-line';

                            const badgeEstado = `<span class="badge ${colorClase} text-white px-2 py-1">
                                                    <i class="${icono} me-1"></i> ${p.estado}
                                                 </span>`;

                            html += `
                                <tr class="fila-paciente-clicable" onclick="window.location.href='perfilPacientes.html?id=${p.id}'">
                                    <td class="ps-4 align-middle">
                                        <div class="paciente-avatar-container" style="width: 45px; height: 45px; border-radius: 50%; border: 2px solid var(--accent-color); background-image: url('${rutaFoto}'), url('assets/images/user.png'); background-size: cover; background-position: center; display: inline-block;"></div>
                                    </td>
                                    <td class="align-middle"><span class="fw-bold text-dark">${p.nombre}</span></td>
                                    <td class="align-middle">${p.edad || '--'} años</td>
                                    <td class="align-middle">${p.sexo || '--'}</td>
                                    <td class="pe-4 align-middle">${badgeEstado}</td>
                                </tr>`;
                        });

                        $('#cuerpoTabla').html(html || '<tr><td colspan="5" class="text-center p-4 text-muted">Aún no hay pacientes</td></tr>');
                    } catch (error) { 
                        console.error("Error dashboard:", error); 
                    }
                }

                cargarDispositivosInicio();
                cargarDashboard();
                cargarGraficasClinicas(); 

                window.addEventListener('storage', (e) => {
                    if (e.key === 'selected-theme' && ultimosDatosGraficas) {
                        crearOActualizarGraficaLinea(ultimosDatosGraficas);
                    }
                });

            });

        } else {
            setTimeout(inicializarDashboard, 50);
        }
    };

    inicializarDashboard();
})();