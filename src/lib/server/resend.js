import { Resend } from 'resend';
import { RESEND_API_KEY, FROM_EMAIL } from '$env/static/private';

/**
 * Instancia singleton de Resend para envío de emails.
 * Uso:
 *   import { resend, defaultFrom } from '$lib/server/resend.js';
 *   await resend.emails.send({ from: defaultFrom, to: '...', subject: '...', html: '...' });
 */
export const resend = new Resend(RESEND_API_KEY);
export const defaultFrom = FROM_EMAIL;

// Función centralizada para enviar correos usando la instancia singleton de Resend
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

