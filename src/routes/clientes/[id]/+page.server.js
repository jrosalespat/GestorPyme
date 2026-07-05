import { prisma } from '$lib/server/prisma.js';
import { fail, error } from '@sveltejs/kit';

// ─────────────────────────────────────────────
// LOAD
// ─────────────────────────────────────────────
/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: params.id },
    include: {
      cotizaciones: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          folio: true,
          estado: true,
          total: true,
          fechaEmision: true,
          fechaVence: true,
          moneda: true,
          pagos: {
            select: { monto: true }
          }
        }
      }
    }
  });

  if (!cliente) throw error(404, 'Cliente no encontrado');

  // ── KPIs financieros ──────────────────────
  const totalFacturado = cliente.cotizaciones
    .filter(c => ['ENVIADA','ACEPTADA','PAGADA'].includes(c.estado))
    .reduce((acc, c) => acc + Number(c.total), 0);

  const totalCobrado = cliente.cotizaciones
    .flatMap(c => c.pagos)
    .reduce((acc, p) => acc + Number(p.monto), 0);

  const totalPendiente = totalFacturado - totalCobrado;

  return {
    cliente: {
      ...cliente,
      cotizaciones: cliente.cotizaciones.map(c => ({
        ...c,
        total: Number(c.total),
        pagos: c.pagos.map(p => ({ ...p, monto: Number(p.monto) }))
      }))
    },
    kpis: {
      totalFacturado,
      totalCobrado,
      totalPendiente
    }
  };
}

// ─────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────
/** @type {import('./$types').Actions} */
export const actions = {

  desactivar: async ({ params }) => {
    const id = params.id;

    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) return fail(404, { error: 'Cliente no encontrado' });
    if (!cliente.activo) return fail(400, { error: 'El cliente ya está inactivo' });

    await prisma.cliente.update({
      where: { id },
      data: { activo: false }
    });

    return { success: true, flash: `Cliente "${cliente.nombre}" desactivado.` };
  }
};
