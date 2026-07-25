import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function enviarCorreoRecuperacion(destinatario, nombreMedico, linkRecuperacion) {
    await resend.emails.send({
        from: 'DETEC TDAH <onboarding@resend.dev>',
        to: destinatario,
        subject: 'Recuperación de contraseña - DETEC TDAH',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
                <h2>Recuperación de contraseña</h2>
                <p>Hola${nombreMedico ? ' ' + nombreMedico : ''},</p>
                <p>Solicitaste restablecer tu contraseña en DETEC TDAH. Haz clic en el siguiente botón para crear una nueva:</p>
                <p style="text-align:center; margin: 24px 0;">
                    <a href="${linkRecuperacion}" style="background:#2563eb; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none;">
                        Restablecer contraseña
                    </a>
                </p>
                <p style="color:#666; font-size: 13px;">Este link expira en 1 hora. Si no solicitaste esto, ignora este correo.</p>
            </div>
        `
    });
}