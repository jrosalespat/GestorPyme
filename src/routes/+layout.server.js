import { buildClerkProps } from 'svelte-clerk/server';

/**
 * Layout server load.
 * - buildClerkProps: serializa el estado de autenticación para SSR
 *   y lo pasa al ClerkProvider del cliente via data.initialState.
 * - user/session: disponibles desde locals.auth() para usarlos en el layout.
 *
 * @type {import('./$types').LayoutServerLoad}
 */
export async function load({ locals }) {
  const auth = locals.auth();

  return {
    // initialState es requerido por <ClerkProvider> para el SSR/hidratación
    ...buildClerkProps(locals.auth),
    // Exponemos userId y sessionId para uso en el layout y rutas hijo
    userId: auth?.userId ?? null,
    sessionId: auth?.sessionId ?? null,
  };
}
