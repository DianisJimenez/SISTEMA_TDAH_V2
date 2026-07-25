// Muestra una notificación tipo "toast" en pantalla
export function showStatusMessage(text, color = "#1e90ff") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    // Mapea el color recibido a un estilo (éxito, error, info, warning...)
    const typeMap = {
        "#2ecc71": "success", "#26a69a": "teal", "#d90429": "error",
        "#e74c3c": "error",   "#ffa500": "warning", "#ff9800": "warning",
        "#8e44ad": "info",    "#2c3e50": "info",    "#4ECDC4": "teal"
    };
    const styles = {
        success: { bg: '#e1f5ee', icon: '✓', iconBg: '#1D9E75', bar: '#1D9E75' },
        error:   { bg: '#FCEBEB', icon: '✕', iconBg: '#E24B4A', bar: '#E24B4A' },
        info:    { bg: '#E6F1FB', icon: 'i', iconBg: '#378ADD', bar: '#378ADD' },
        warning: { bg: '#FAEEDA', icon: '!', iconBg: '#EF9F27', bar: '#EF9F27' },
        teal:    { bg: '#e1f5ee', icon: '↓', iconBg: '#0F6E56', bar: '#0F6E56' },
    };

    const type = typeMap[color] || "info";
    const s = styles[type];

    // Crea el elemento visual del toast
    const t = document.createElement("div");
    t.className = "toast-notif";
    t.style.cssText = `
        position:relative; overflow:hidden; display:flex; align-items:center;
        gap:12px; padding:12px 18px; border-radius:14px; background:${s.bg};
        border:0.5px solid rgba(0,0,0,0.08); box-shadow:0 4px 20px rgba(0,0,0,0.12);
        font-size:14px; font-weight:500; color:#1a1a1a;
        min-width:220px; max-width:320px; animation:toastIn 0.3s ease;
    `;
    t.innerHTML = `
        <div style="width:32px;height:32px;border-radius:50%;background:${s.iconBg};
            color:#fff;display:flex;align-items:center;justify-content:center;
            font-weight:700;font-size:15px;flex-shrink:0;">${s.icon}</div>
        <span style="flex:1;">${text}</span>
        <div style="position:absolute;bottom:0;left:0;height:3px;background:${s.bar};
            border-radius:0 0 14px 14px;animation:toastBar 2s linear forwards;"></div>
    `;
    container.appendChild(t);

    // Se autodestruye después de 2 segundos
    setTimeout(() => {
        t.style.animation = "toastOut 0.3s ease forwards";
        setTimeout(() => t.remove(), 300);
    }, 2000);
}