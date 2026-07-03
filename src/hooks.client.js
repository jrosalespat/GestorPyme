/**
 * hooks.client.js
 *
 * En svelte-clerk v1+ el cliente se inicializa mediante <ClerkProvider>
 * en el layout raíz (+layout.svelte), no aquí.
 *
 * Este archivo solo define el manejador de errores de cliente.
 */

/** @type {import('@sveltejs/kit').HandleClientError} */
export const handleError = async ({ error, event }) => {
  console.error('[Client Error]', error, event);
};
