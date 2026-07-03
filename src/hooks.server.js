import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';
import { redirect } from '@sveltejs/kit';

/**
 * Rutas que NO requieren autenticación (públicas).
 * Todo lo demás será protegido.
 */
const PUBLIC_ROUTES = ['/sign-in', '/sign-up'];

/**
 * Middleware 1: Clerk – autentica la request e inyecta event.locals.auth()
 */
const clerkHandle = withClerkHandler({ debug: false });

/**
 * Middleware 2: Guardia de rutas privadas.
 * Si el usuario no está autenticado y la ruta no es pública → redirige a /sign-in.
 */
const routeGuard = async ({ event, resolve }) => {
  const pathname = event.url.pathname;
  const isPublic = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

  if (!isPublic) {
    const auth = event.locals.auth();
    if (!auth?.userId) {
      throw redirect(302, `/sign-in`);
    }
  }

  return resolve(event);
};

export const handle = sequence(clerkHandle, routeGuard);
