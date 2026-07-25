// Modal "Ver Resumen" de una sesión: bandas, desglose de pruebas y gráfica EEG.
// El PDF vive aparte en reportes-pdf.js. Depende de cacheSesiones (paciente-perfil.js)

async function verResumen(i) {
    const s = cacheSesiones[i];
    let detalles = [];
    try {
        detalles = typeof s.detalles_pruebas === 'string' ? JSON.parse(s.detalles_pruebas) : s.detalles_pruebas || [];
    } catch (e) { console.error(e); }

    const contenido = document.getElementById('tplModalResumen').content.cloneNode(true).firstElementChild;

    contenido.querySelector('.campo-id-sesion').textContent = `ID SESIÓN: #${s.id_sesion}`;
    contenido.querySelector('.campo-fecha-sesion').textContent = new Date(s.fecha_hora).toLocaleString();

    contenido.querySelector('.campo-nombre-paciente').textContent = $('#infoNombre').text();
    contenido.querySelector('.campo-edad-paciente').textContent = $('#infoEdad').text();
    contenido.querySelector('.campo-medico-paciente').textContent = $('#infoDoctor').text() || '---';
    contenido.querySelector('.campo-dispositivo-sesion').textContent = s.nombre_dispositivo || 'Muse';
    contenido.querySelector('.campo-duracion-sesion').textContent = `${Math.round(s.duracion_total_seg)}s`;

    const diagnosticoColor = s.diagnostico === 'TDAH Detectado' ? '#e74c3c' : '#0F6E56';
    const badge = contenido.querySelector('.campo-badge-diagnostico');
    badge.textContent = s.diagnostico || 'Sin diagnóstico';
    badge.style.background = `${diagnosticoColor}22`;
    badge.style.color = diagnosticoColor;

    // interrupcion_conexion llega como 0/1 desde MySQL, por eso el Number(...)
    const huboInterrupcion = Number(s.interrupcion_conexion) === 1;
    if (huboInterrupcion) {
        contenido.querySelector('.seccion-alerta-interrupcion').classList.remove('d-none');
    }

    // Tarjetas de promedio por banda (nivel sesión completa)
    const bandas = [
        { nombre: 'Alpha (Relajación)', valor: s.avg_alpha, color: '#4ECDC4', icono: 'ri-brain-line' },
        { nombre: 'Beta (Enfoque)', valor: s.avg_beta, color: '#E8A93B', icono: 'ri-focus-3-line' },
        { nombre: 'Theta (Memoria)', valor: s.avg_theta, color: '#FF6B6B', icono: 'ri-puzzle-line' }
    ];
    const contenedorBandas = contenido.querySelector('.contenedor-bandas');
    bandas.forEach(b => {
        const porcentaje = Number(b.valor || 0);
        const card = document.getElementById('tplBandaCard').content.cloneNode(true).firstElementChild;
        card.querySelector('.campo-nombre').textContent = b.nombre;
        const valor = card.querySelector('.campo-valor');
        valor.textContent = `${porcentaje.toFixed(1)}%`;
        valor.style.color = b.color;
        const relleno = card.querySelector('.campo-relleno');
        relleno.style.width = `${Math.min(porcentaje, 100)}%`;
        relleno.style.background = b.color;
        const icono = card.querySelector('.campo-icono');
        icono.innerHTML = `<i class="${b.icono}"></i>`;
        icono.style.background = `${b.color}22`;
        icono.style.color = b.color;
        contenedorBandas.appendChild(card);
    });

    // Desglose de pruebas
    const tbodyDetalles = contenido.querySelector('.contenedor-detalles-pruebas');
    if (detalles.length > 0) {
        const fix = (v) => Number(v || 0).toFixed(1) + '%';
        detalles.forEach(d => {
            const inicio = Math.round(parseFloat(d.inicio) || 0);
            const duracion = Math.round(parseFloat(d.duracion) || 0);
            const fila = document.getElementById('tplFilaDetallePrueba').content.cloneNode(true).firstElementChild;
            fila.querySelector('.campo-nombre').textContent = d.nombre;
            fila.querySelector('.campo-inicio').textContent = `${inicio}s`;
            fila.querySelector('.campo-fin').textContent = `${inicio + duracion}s`;
            fila.querySelector('.campo-duracion').textContent = `${duracion}s`;
            fila.querySelector('.campo-theta').textContent = fix(d.avg_theta);
            fila.querySelector('.campo-alpha').textContent = fix(d.avg_alpha);
            fila.querySelector('.campo-beta').textContent = fix(d.avg_beta);

            fila.querySelector('.btn-ver-eeg-prueba').onclick = () => verEEGPrueba(s.id_sesion, d);

            const btnDescargarPrueba = fila.querySelector('.btn-descargar-csv-prueba');
            if (d.csv_ruta) {
                btnDescargarPrueba.onclick = () => descargarArchivo(d.csv_ruta, `EEG_${s.id_sesion}_${d.nombre}.csv`);
            } else {
                btnDescargarPrueba.disabled = true;
                btnDescargarPrueba.title = 'Sin CSV individual para esta prueba';
            }

            tbodyDetalles.appendChild(fila);
        });
    } else {
        const filaVacia = document.getElementById('tplFilaDetalleVacia').content.cloneNode(true);
        tbodyDetalles.appendChild(filaVacia);
    }

    contenido.querySelector('.campo-comentario').value = s.comentario || '';

    $('#cuerpoModalResumen').empty().append(contenido);
    const modal = new bootstrap.Modal(document.getElementById('modalResumen'));
    modal.show();

    // Guardar comentario clínico (reenvía el diagnóstico actual porque el endpoint lo exige)
    $('.btn-guardar-comentario').off('click').on('click', async function () {
        const btn = $(this);
        const comentario = $('.campo-comentario').val();
        btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span>');
        try {
            const res = await fetch(`/api/sesiones/${s.id_sesion}/diagnostico`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ diagnostico: s.diagnostico || 'Sin diagnóstico', comentario })
            });
            const data = await res.json();
            if (data.success) {
                s.comentario = comentario;
                btn.html('<i class="ri-check-line me-1"></i> Guardado');
                setTimeout(() => btn.html('<i class="ri-save-line me-1"></i> Guardar comentario').prop('disabled', false), 1200);
            } else {
                alert('No se pudo guardar el comentario: ' + (data.error || 'error desconocido'));
                btn.prop('disabled', false).html('<i class="ri-save-line me-1"></i> Guardar comentario');
            }
        } catch (e) {
            console.error('Error al guardar comentario:', e);
            alert('Error de conexión al guardar el comentario.');
            btn.prop('disabled', false).html('<i class="ri-save-line me-1"></i> Guardar comentario');
        }
    });

    // Doble rAF: espera a que el modal termine su transición para que Chart.js no tiemble al medir el canvas
    $('#modalResumen').one('shown.bs.modal', () => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                dibujarGraficaDesdeJSON(s.id_sesion);
            });
        });
    });

    // Redibuja la gráfica si se cambia el tamaño de la ventana con el modal abierto.
    $(window).off('resize.reporteGrafica').on('resize.reporteGrafica', function () {
        clearTimeout(window._resizeGraficaTimeout);
        window._resizeGraficaTimeout = setTimeout(() => dibujarGraficaDesdeJSON(s.id_sesion), 200);
    });

    $('#modalResumen').off('hidden.bs.modal.reporteGrafica').one('hidden.bs.modal.reporteGrafica', function () {
        $(window).off('resize.reporteGrafica');
        clearTimeout(window._resizeGraficaTimeout);
    });

    $('#btnDescargarPDF').off('click').on('click', function () {
        descargarReportePDF(i);
    });

    $('#btnDescargarCSV').off('click').on('click', function () {
        if (s.csv_ruta) {
            descargarArchivo(s.csv_ruta, `EEG_Sesion_${s.id_sesion}.csv`);
        } else {
            alert("No hay un archivo CSV registrado para esta sesión.");
        }
    });
}

// Descarga cualquier archivo servido por el backend (usada tanto por el CSV de sesión como por el de cada prueba)
function descargarArchivo(ruta, nombreDescarga) {
    const link = document.createElement('a');
    link.href = `/${ruta}`;
    link.setAttribute('download', nombreDescarga);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Modal del ícono 👁: gráfica EEG recortada solo al tramo de esa prueba (eje X arranca en 0 = inicio de la prueba)
async function verEEGPrueba(idSesion, prueba) {
    document.getElementById('tituloModalEEGPrueba').textContent = `EEG — ${prueba.nombre}`;
    document.getElementById('loaderEEGPrueba').style.display = 'block';

    const modal = new bootstrap.Modal(document.getElementById('modalEEGPrueba'));
    modal.show();

    try {
        const resp = await fetch(`/api/sesiones/${idSesion}/evolucion`);
        if (!resp.ok) throw new Error("Sin datos de gráfica para esta sesión");
        const dataFull = await resp.json();
        if (!dataFull || dataFull.length === 0) throw new Error("JSON vacío");

        const t0 = parseFloat(dataFull[0].t);
        const inicio = parseFloat(prueba.inicio);
        const fin = inicio + parseFloat(prueba.duracion);

        const tramo = dataFull
            .map(p => ({ t: parseFloat(p.t) - t0, theta: parseFloat(p.theta), alpha: parseFloat(p.alpha), beta: parseFloat(p.beta) }))
            .filter(p => p.t >= inicio && p.t <= fin);

        const datasetTheta = tramo.map(p => ({ x: p.t - inicio, y: p.theta }));
        const datasetAlpha = tramo.map(p => ({ x: p.t - inicio, y: p.alpha }));
        const datasetBeta = tramo.map(p => ({ x: p.t - inicio, y: p.beta }));

        document.getElementById('loaderEEGPrueba').style.display = 'none';

        if (window.chartEEGPrueba) window.chartEEGPrueba.destroy();
        const ctx = document.getElementById('canvasEEGPrueba').getContext('2d');
        window.chartEEGPrueba = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    { label: 'Theta', data: datasetTheta, borderColor: '#FF6B6B', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
                    { label: 'Alpha', data: datasetAlpha, borderColor: '#4ECDC4', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
                    { label: 'Beta', data: datasetBeta, borderColor: '#E8A93B', borderWidth: 1.5, pointRadius: 0, tension: 0.3 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'linear', min: 0, max: fin - inicio, title: { display: true, text: 'Segundos (desde el inicio de la prueba)' } },
                    y: { min: 0, max: 100, title: { display: true, text: '% de energía por banda' } }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`
                        }
                    }
                }
            }
        });
    } catch (e) {
        console.error("Error al graficar la prueba:", e);
        document.getElementById('loaderEEGPrueba').innerHTML = '<p class="small text-muted mb-0">No se pudo cargar el EEG de esta prueba.</p>';
    }
}

async function dibujarGraficaDesdeJSON(idSesion) {
    try {
        // Los datos de evolución viven en la columna datos_grafica de sesiones_paciente, no en un JSON en disco
        const resp = await fetch(`/api/sesiones/${idSesion}/evolucion`);
        if (!resp.ok) throw new Error("Sin datos de gráfica para esta sesión");

        const dataFull = await resp.json();
        if (!dataFull || dataFull.length === 0) throw new Error("JSON vacío");

        const t0 = parseFloat(dataFull[0].t);
        if (isNaN(t0)) {
            throw new Error("Los datos de esta sesión no tienen el formato esperado (falta 't').");
        }

        const sesionActual = cacheSesiones.find(s => s.id_sesion == idSesion);
        let detalles = [];
        if (sesionActual && sesionActual.detalles_pruebas) {
            detalles = (typeof sesionActual.detalles_pruebas === 'string')
                ? JSON.parse(sesionActual.detalles_pruebas)
                : sesionActual.detalles_pruebas;
        }

        $('#loaderGrafica').hide();
        const canvasEl = document.getElementById('canvasGraficaReporte');
        const ctx = canvasEl.getContext('2d');

        const datasetTheta = dataFull.map(p => ({ x: parseFloat(p.t) - t0, y: parseFloat(p.theta) }));
        const datasetAlpha = dataFull.map(p => ({ x: parseFloat(p.t) - t0, y: parseFloat(p.alpha) }));
        const datasetBeta = dataFull.map(p => ({ x: parseFloat(p.t) - t0, y: parseFloat(p.beta) }));

        // Marcadores de inicio/fin de cada prueba + marcador final de sesión
        const datasetEventos = [];
        detalles.forEach((d) => {
            const inicioX = parseFloat(d.inicio);
            const finX = inicioX + parseFloat(d.duracion);

            datasetEventos.push({
                x: inicioX,
                y: 95,
                color: '#00FF00',
                nombre: `INICIO: ${d.nombre}`
            });

            datasetEventos.push({
                x: finX,
                y: 95,
                color: '#0000FF',
                nombre: `FIN: ${d.nombre}`
            });
        });

        const ultimoP = dataFull[dataFull.length - 1];
        const duracionSesion = parseFloat(ultimoP.t) - t0;
        datasetEventos.push({
            x: duracionSesion,
            y: 95,
            color: '#FF0000',
            nombre: 'FINAL DE SESIÓN'
        });

        if (window.chartReporte) window.chartReporte.destroy();


        const contenedorCanvas = canvasEl.parentElement;
        contenedorCanvas.style.overflowX = 'auto';
        contenedorCanvas.style.overflowY = 'hidden';
        contenedorCanvas.style.boxSizing = 'border-box';

        // Legend fija en HTML, pegada arriba de la gráfica (junto al título), que no se mueve
        const legendItems = [
            { label: 'Eventos', color: '#00C853' },
            { label: 'Theta', color: '#FF6B6B' },
            { label: 'Alpha', color: '#4ECDC4' },
            { label: 'Beta', color: '#E8A93B' }
        ];
        let legendEl = contenedorCanvas.parentElement.querySelector('.leyenda-grafica-reporte');
        if (!legendEl) {
            legendEl = document.createElement('div');
            legendEl.className = 'leyenda-grafica-reporte';
            legendEl.style.cssText = 'display:flex; justify-content:center; gap:18px; margin-bottom:10px; flex-wrap:wrap;';
            contenedorCanvas.parentElement.insertBefore(legendEl, contenedorCanvas);
        }
        legendEl.innerHTML = legendItems.map((li, idx) => `
            <span class="legend-item-reporte" data-index="${idx}" style="display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:bold; color:#334155; cursor:pointer; user-select:none;">
                <span class="legend-swatch-reporte" style="width:14px; height:10px; border-radius:3px; background:${li.color}; display:inline-block;"></span>
                <span class="legend-label-reporte">${li.label}</span>
            </span>
        `).join('');

        // Ancho dinámico según la duración real: a mayor duración, más ancho (con scroll),
        // en vez de aplastar todos los picos dentro del mismo espacio fijo.
        const PX_POR_SEGUNDO = 9; // suficiente separación para distinguir los picos de 1s
        const anchoMinimo = contenedorCanvas.clientWidth || 600;
        const anchoCalculado = Math.round(duracionSesion * PX_POR_SEGUNDO);
        const anchoFijo = Math.max(anchoMinimo, anchoCalculado);
        const necesitaScroll = anchoCalculado > anchoMinimo;

        // Más alta que el original, pero sin pasarse: 420px hacía que el MODAL completo
        // (no solo la gráfica) necesitara scroll vertical. 300px es un término medio.
        const altoFijo = 300;
        contenedorCanvas.style.height = `${altoFijo}px`;
        canvasEl.width = anchoFijo;
        canvasEl.height = altoFijo;
        canvasEl.style.width = `${anchoFijo}px`;
        canvasEl.style.height = `${altoFijo}px`;

        // Si el canvas cabe completo en el contenedor (sesión corta), se centra con margen.
        // Si necesita scroll (sesión larga), sin margen y arrancando en 0 para no tapar el eje Y.
        if (necesitaScroll) {
            canvasEl.style.margin = '0';
            contenedorCanvas.scrollLeft = 0;
        } else {
            canvasEl.style.margin = '0 auto';
        }

        window.chartReporte = new Chart(ctx, {
            type: 'line',
            data: {
                // Orden del array = orden de la leyenda; 'order' de cada dataset manda en el z-index del dibujado
                datasets: [
                    {
                        label: 'Eventos',
                        data: datasetEventos,
                        type: 'scatter',
                        pointRadius: 8,
                        order: 1,
                        pointBackgroundColor: (c) => c.raw ? c.raw.color : '#000',
                        backgroundColor: '#00C853'
                    },
                    { label: 'Theta', data: datasetTheta, borderColor: '#FF6B6B', borderWidth: 1.25, pointRadius: 0, order: 2, tension: 0.3 },
                    { label: 'Alpha', data: datasetAlpha, borderColor: '#4ECDC4', borderWidth: 1.25, pointRadius: 0, order: 2, tension: 0.3 },
                    { label: 'Beta', data: datasetBeta, borderColor: '#E8A93B', borderWidth: 1.25, pointRadius: 0, order: 2, tension: 0.3 }
                ]
            },
            options: {
                animation: false,
                responsive: false,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: duracionSesion,
                        title: { display: true, text: 'Segundos' }
                    },
                    y: {
                        // Bandas en % relativo (theta+alpha+beta≈100), no en µV
                        min: 0,
                        max: 100,
                        title: { display: true, text: '% de energía por banda' }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const p = context.raw;
                                const fix = (val) => (typeof val === 'number' ? val.toFixed(2) : "0.00");

                                if (p.nombre) {
                                    return [
                                        `📍 ${p.nombre}`,
                                        `⏱️ Tiempo: ${fix(p.x)}s`
                                    ];
                                }
                                return `${context.dataset.label}: ${fix(p.y)}%`;
                            }
                        }
                    }
                }
            }
        });

        if (necesitaScroll) contenedorCanvas.scrollLeft = 0;

        // Botoncitos de la leyenda clicables: ocultan/muestran
        legendEl.querySelectorAll('.legend-item-reporte').forEach(item => {
            item.onclick = () => {
                const idx = Number(item.dataset.index);
                const meta = window.chartReporte.getDatasetMeta(idx);
                meta.hidden = !meta.hidden;
                item.style.opacity = meta.hidden ? '0.4' : '1';
                item.querySelector('.legend-label-reporte').style.textDecoration = meta.hidden ? 'line-through' : 'none';
                window.chartReporte.update();
            };
        });
    } catch (e) {
        console.error("Error:", e);
        $('#loaderGrafica').html('<p class="small text-muted mb-0">No se pudo cargar la gráfica de esta sesión.</p>');
    }
}