import { prisma } from '$lib/server/prisma.js';

/** @type {import('./$types').PageServerLoad} */
export async function load() {
  const cotizaciones = await prisma.cotizacion.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      cliente: {
        select: { id: true, nombre: true, empresa: true }
      },
      pagos: { select: { monto: true } }
    }
  });

  // Serializar Decimal a number para Svelte
  return {
    cotizaciones: cotizaciones.map(c => {
      // Extraemos pagos del spread para no enviar Decimals sin convertir
      const { pagos, ...rest } = c;
      return {
        ...rest,
        subtotal:  Number(c.subtotal),
        descuento: Number(c.descuento),
        iva:       Number(c.iva),
        total:     Number(c.total),
        cobrado:   pagos.reduce((acc, p) => acc + Number(p.monto), 0),
      };
    })
  };
}
