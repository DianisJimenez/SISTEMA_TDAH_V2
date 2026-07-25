// Generación del PDF del reporte clínico de sesión (jsPDF + autoTable).
function cargarLogoParaPDF() {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve({
                    dataUrl: canvas.toDataURL('image/png'),
                    ratio: img.naturalWidth / img.naturalHeight
                });
            } catch (e) {
                console.error('No se pudo procesar logoTDHA.png:', e);
                resolve(null);
            }
        };
        let intentoRespaldo = false;
        img.onerror = () => {
            if (!intentoRespaldo) {
                intentoRespaldo = true;
                img.src = '/assets/images/logo.png';
            } else {
                resolve(null);
            }
        };
        img.src = '/assets/images/logoTDHA.png';
    });
}

async function descargarReportePDF(i) {
    const s = cacheSesiones[i];
    if (!s) return alert("No se encontró la sesión.");

    const { jsPDF } = window.jspdf;
    // Portrait: ya no lleva gráfica ancha, se lee como hoja membretada de una columna
    const doc = new jsPDF('p', 'mm', 'a4');

    // Paleta alineada con --rc-navy / --rc-blue de perfilPacientes.css
    const COLOR_NAVY = [11, 42, 91];
    const COLOR_NAVY_DARK = [7, 28, 61];
    const COLOR_BLUE = [24, 87, 201];
    const COLOR_TEXTO = [30, 41, 59];
    const COLOR_GRIS = [100, 116, 139];
    const COLOR_HEAD_BG = [241, 245, 249];
    const anchoPagina = doc.internal.pageSize.getWidth();
    const margen = 16;

    doc.setDrawColor(...COLOR_TEXTO);
    doc.setLineWidth(0.4);
    doc.rect(6, 6, anchoPagina - 12, doc.internal.pageSize.getHeight() - 12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(...COLOR_NAVY);
    doc.text("DETEC TDAH", margen, 24);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_GRIS);
    doc.text("R E P O R T E   C L Í N I C O   D E   S E S I Ó N", margen, 31);

    const logo = await cargarLogoParaPDF();
    if (logo) {
        const altoLogo = 16;
        const anchoLogo = altoLogo * logo.ratio;
        const xLogo = anchoPagina - margen - anchoLogo;
        doc.addImage(logo.dataUrl, 'PNG', xLogo, 8, anchoLogo, altoLogo);
    } else {
        const cxInsignia = anchoPagina - margen - 9;
        const cyInsignia = 16;
        doc.setFillColor(...COLOR_NAVY);
        doc.circle(cxInsignia, cyInsignia, 9, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("DT", cxInsignia, cyInsignia + 3, { align: "center" });
    }

    doc.setDrawColor(...COLOR_NAVY);
    doc.setLineWidth(0.8);
    doc.line(margen, 37, anchoPagina - margen, 37);

    let yFolio = 46;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_GRIS);
    doc.text("FOLIO DE SESIÓN:", margen, yFolio);
    doc.setTextColor(...COLOR_TEXTO);
    doc.text(`#${s.id_sesion}`, margen + 34, yFolio);

    yFolio += 6;
    doc.setTextColor(...COLOR_GRIS);
    doc.text("FECHA:", margen, yFolio);
    doc.setTextColor(...COLOR_TEXTO);
    doc.text(`${new Date(s.fecha_hora).toLocaleString()}`, margen + 34, yFolio);

    let cursorY = yFolio + 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_NAVY);
    doc.text("INFORMACIÓN DE LA SESIÓN", margen, cursorY);
    cursorY += 4;

    doc.autoTable({
        startY: cursorY,
        margin: { left: margen, right: margen },
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3, textColor: COLOR_TEXTO, lineColor: [226, 232, 240], lineWidth: 0.2 },
        headStyles: { fillColor: COLOR_NAVY, textColor: 255, fontStyle: 'bold', fontSize: 7.5, halign: 'left' },
        head: [['Paciente', 'Edad', 'CURP', 'Teléfono', 'Médico responsable', 'Dispositivo', 'Duración', 'Diagnóstico']],
        body: [[
            $('#infoNombre').text() || '---',
            $('#infoEdad').text() || '--',
            $('#infoCurp').text() || '---',
            $('#infoTelefono').text() || '---',
            $('#infoDoctor').text() || '---',
            s.nombre_dispositivo || 'Muse',
            `${Math.round(s.duracion_total_seg)}s`,
            s.diagnostico || 'Sin diagnóstico'
        ]]
    });

    cursorY = doc.lastAutoTable.finalY + 8;

    const huboInterrupcion = Number(s.interrupcion_conexion) === 1;
    if (huboInterrupcion) {
        doc.setFillColor(250, 238, 218);
        doc.setDrawColor(239, 159, 39);
        doc.roundedRect(margen, cursorY, anchoPagina - margen * 2, 12, 2, 2, 'FD');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(138, 90, 16);
        doc.text("Se detectó una interrupción de señal durante esta sesión.", margen + 4, cursorY + 5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...COLOR_GRIS);
        doc.text("Los datos pueden tener huecos en el tramo donde se perdió la conexión.", margen + 4, cursorY + 9);
        cursorY += 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_NAVY);
    doc.text("PROMEDIOS DE LA SESIÓN", margen, cursorY);
    cursorY += 4;

    const bandas = [
        { nombre: 'Alpha (Relajación)', valor: s.avg_alpha },
        { nombre: 'Beta (Enfoque)', valor: s.avg_beta },
        { nombre: 'Theta (Memoria)', valor: s.avg_theta }
    ];

    doc.autoTable({
        startY: cursorY,
        margin: { left: margen, right: margen },
        tableWidth: 130,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3, textColor: COLOR_TEXTO, lineColor: [226, 232, 240], lineWidth: 0.2 },
        headStyles: { fillColor: COLOR_NAVY, textColor: 255, fontStyle: 'bold', fontSize: 7.5, halign: 'left' },
        alternateRowStyles: { fillColor: COLOR_HEAD_BG },
        head: [['Banda Cerebral', 'Promedio Relativo (%)']],
        body: bandas.map(b => [b.nombre, `${Number(b.valor || 0).toFixed(1)}%`])
    });

    cursorY = doc.lastAutoTable.finalY + 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_NAVY);
    doc.text("DETALLE DE PRUEBAS REALIZADAS", margen, cursorY);
    cursorY += 4;

    let detalles = [];
    try {
        detalles = typeof s.detalles_pruebas === 'string' ? JSON.parse(s.detalles_pruebas) : s.detalles_pruebas || [];
    } catch (e) { console.error(e); }

    const filasPruebas = detalles.map(d => {
        const inicio = Math.round(parseFloat(d.inicio) || 0);
        const duracion = Math.round(parseFloat(d.duracion) || 0);
        return [
            d.nombre,
            `${inicio}s`,
            `${inicio + duracion}s`,
            `${duracion}s`,
            `${Number(d.avg_theta || 0).toFixed(1)}%`,
            `${Number(d.avg_alpha || 0).toFixed(1)}%`,
            `${Number(d.avg_beta || 0).toFixed(1)}%`
        ];
    });

    doc.autoTable({
        startY: cursorY,
        margin: { left: margen, right: margen },
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2.5, textColor: COLOR_TEXTO, lineColor: [226, 232, 240], lineWidth: 0.2 },
        headStyles: { fillColor: COLOR_NAVY, textColor: 255, fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: COLOR_HEAD_BG },
        head: [['Prueba', 'Inicio', 'Fin', 'Duración', 'Theta', 'Alpha', 'Beta']],
        body: filasPruebas.length > 0 ? filasPruebas : [['Sin registros.', '', '', '', '', '', '']]
    });

    cursorY = doc.lastAutoTable.finalY + 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_NAVY);
    doc.text("COMENTARIO CLÍNICO", margen, cursorY);
    cursorY += 4;

    const comentario = s.comentario || 'Sin comentarios para esta sesión.';
    const anchoCaja = anchoPagina - margen * 2;
    const altoCaja = 26;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(margen, cursorY, anchoCaja, altoCaja, 2, 2);

    doc.setFont("helvetica", s.comentario ? "normal" : "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_GRIS);
    const lineasComentario = doc.splitTextToSize(comentario, anchoCaja - 8);
    doc.text(lineasComentario, margen + 4, cursorY + 7);

    cursorY += altoCaja + 16;

    const anchoFirma = 70;
    const xFirma = anchoPagina - margen - anchoFirma;
    doc.setDrawColor(...COLOR_GRIS);
    doc.setLineWidth(0.3);
    doc.line(xFirma, cursorY, xFirma + anchoFirma, cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_GRIS);
    doc.text("Firma del médico responsable", xFirma + anchoFirma / 2, cursorY + 5, { align: "center" });

    const yPie = doc.internal.pageSize.getHeight() - 12;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margen, yPie - 4, anchoPagina - margen, yPie - 4);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_GRIS);
    doc.text(
        "Documento generado por DETEC TDAH · Uso clínico interno ·",
        margen,
        yPie
    );

    doc.save(`Reporte_DETEC_TDAH_S${s.id_sesion}.pdf`);
}