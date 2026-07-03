import { Resend } from 'resend';
import { RESEND_API_KEY, FROM_EMAIL } from '$env/static/private';

/**
 * Instancia singleton de Resend para envío de emails.
 * Uso:
 *   import { resend, defaultFrom } from '$lib/resend';
 *   await resend.emails.send({ from: defaultFrom, to: '...', subject: '...', html: '...' });
 */
export const resend = new Resend(RESEND_API_KEY);
export const defaultFrom = FROM_EMAIL;
