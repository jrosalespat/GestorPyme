import { Resend } from 'resend';
import { RESEND_API_KEY, FROM_EMAIL } from '$env/static/private';

// Exportamos las variables originales para no romper nada existente
export const resend = new Resend(RESEND_API_KEY);
export const defaultFrom = FROM_EMAIL;

// Nuestra nueva función con logs para cazar el error
export async function sendEmail({ to, subject, html }) {
    console.log('\n--- 📧 INICIANDO ENVÍO DE CORREO (RESEND) ---');
    console.log(`Destinatario (TO): ${to}`);
    console.log(`Remitente (FROM): ${defaultFrom}`);
    console.log(`Asunto: ${subject}`);

    try {
        const response = await resend.emails.send({
            from: defaultFrom,
            to: to,
            subject: subject,
            html: html
        });

        // Si Resend devuelve un error controlado
        if (response.error) {
            console.error('⚠️ Resend rechazó el envío:', response.error);
            return { ok: false, error: response.error };
        }

        console.log('✅ ¡Envío exitoso! ID de Resend:', response.data?.id);
        console.log('-------------------------------------------\n');
        return { ok: true, id: response.data?.id };

    } catch (error) {
        // Si la conexión falla rotundamente
        console.error('❌ Error crítico (Catch) al conectar con Resend:', error.message || error);
        console.log('-------------------------------------------\n');
        return { ok: false, error: error.message };
    }
}