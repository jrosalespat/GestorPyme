import { prisma } from '$lib/server/prisma.js';
import { fail, redirect } from '@sveltejs/kit';
import { parseCotizacionForm } from '$lib/schemas/cotizacion.js';
import { sendEmail } from '$lib/server/resend.js';

// ── LOAD: calcula el siguiente folio y carga clientes ──────────────────────
/** @type {import('./$types').PageServerLoad} */
export async function load() {
  const [clientes, ultimaCot] = await Promise.all([
    prisma.cliente.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, empresa: true, email: true }
    }),
    prisma.cotizacion.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { folio: true }
    })
  ]);

  // Calcular siguiente folio: COT-YYYY-NNN
  const year = new Date().getFullYear();
  let seq = 1;
  if (ultimaCot?.folio) {
    const match = ultimaCot.folio.match(/(\d+)$/);
    if (match) seq = parseInt(match[1]) + 1;
  }
  const siguienteFolio = `COT-${year}-${String(seq).padStart(3, '0')}`;

  return { clientes, siguienteFolio };
}

// ── ACTIONS ────────────────────────────────────────────────────────────────
/** @type {import('./$types').Actions} */
export const actions = {

  guardar: async ({ request }) => {
    const fd = await request.formData();
    const { data, errors, values } = parseCotizacionForm(fd);

    if (errors) {
      return fail(400, { errors, values });
    }

    const { conceptos, aplicaIva, estado, clienteId, validezDias, moneda, notas, terminos } = data;

    // ── Calcular totales ─────────────────────────────────────────────────
    const subtotalBase = conceptos.reduce((acc, con) => {
      const sub = con.cantidad * con.precioUnitario * (1 - con.descuento / 100);
      return acc + sub;
    }, 0);

    const ivaVal      = aplicaIva === 'si' ? subtotalBase * 0.16 : 0;
    const totalVal    = subtotalBase + ivaVal;

    // ── Siguiente folio ──────────────────────────────────────────────────
    const ultimaCot = await prisma.cotizacion.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { folio: true }
    });
    const year = new Date().getFullYear();
    let seq = 1;
    if (ultimaCot?.folio) {
      const match = ultimaCot.folio.match(/(\d+)$/);
      if (match) seq = parseInt(match[1]) + 1;
    }
    const folio = `COT-${year}-${String(seq).padStart(3, '0')}`;

    // ── Fecha de vencimiento ─────────────────────────────────────────────
    const fechaVence = new Date();
    fechaVence.setDate(fechaVence.getDate() + validezDias);

    // ── Transacción: crear Cotizacion + Conceptos ────────────────────────
    const nueva = await prisma.$transaction(async (tx) => {
      const cot = await tx.cotizacion.create({
        data: {
          folio,
          clienteId,
          estado,
          subtotal:   subtotalBase,
          iva:        ivaVal,
          descuento:  0,
          total:      totalVal,
          moneda,
          validezDias,
          notas:      notas || null,
          terminos:   terminos || null,
          fechaVence,
          conceptos: {
            create: conceptos.map((con, idx) => {
              const sub = con.cantidad * con.precioUnitario * (1 - con.descuento / 100);
              return {
                descripcion:    con.descripcion,
                cantidad:       con.cantidad,
                unidad:         con.unidad || 'pieza',
                precioUnitario: con.precioUnitario,
                descuento:      con.descuento,
                subtotal:       sub,
                orden:          idx,
              };
            })
          }
        }
      });

      // Registrar en historial
      await tx.historialCot.create({
        data: {
          cotizacionId:  cot.id,
          estadoAnterior: null,
          estadoNuevo:   estado,
          nota: estado === 'ENVIADA' ? 'Cotización creada y enviada al cliente' : 'Cotización creada como borrador',
        }
      });

      return cot;
    });

    // ── Si ENVIADA → enviar correo real con Resend ────────────────────────
    if (estado === 'ENVIADA') {
      const cot = await prisma.cotizacion.findUnique({
        where: { id: nueva.id },
        include: { cliente: true, conceptos: true }
      });

      if (cot?.cliente?.email) {
        const formattedTotal = new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: cot.moneda || 'MXN'
        }).format(Number(cot.total));

        const formattedFecha = cot.fechaVence ? new Date(cot.fechaVence).toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) : 'No especificada';

        const formatCurrency = (val) => new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: cot.moneda || 'MXN'
        }).format(Number(val));

        const conceptsHtmlRows = cot.conceptos.map(c => `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px; text-align: left; font-size: 14px; color: #374151;">${c.descripcion}</td>
            <td style="padding: 8px; text-align: left; font-size: 14px; color: #374151;">${c.cantidad}</td>
            <td style="padding: 8px; text-align: left; font-size: 14px; color: #374151;">${formatCurrency(c.subtotal)}</td>
          </tr>
        `).join('');

        const emailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #1f2937; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 25px;">
              <h1 style="color: #1e3a8a; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.05em;">GestorPyme</h1>
              <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">Cotización de servicios / productos</p>
            </div>
            
            <h2 style="color: #1f2937; font-size: 20px; margin-top: 0; font-weight: 600;">Estimado/a ${cot.cliente.nombre},</h2>
            
            <p style="font-size: 16px; line-height: 1.6; color: #4b5563; margin-bottom: 20px;">
              Es un placer saludarle. Le compartimos los detalles de la cotización <strong>${cot.folio}</strong> que hemos preparado para usted.
            </p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 14px; font-weight: 500;">Folio:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${cot.folio}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 14px; font-weight: 500;">Total:</td>
                  <td style="padding: 6px 0; color: #10b981; font-size: 16px; font-weight: 700; text-align: right;">${formattedTotal}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 14px; font-weight: 500;">Vencimiento:</td>
                  <td style="padding: 6px 0; color: #dfc218; font-size: 14px; font-weight: 600; text-align: right;">${formattedFecha}</td>
                </tr>
              </table>
            </div>

            <h3 style="color: #1e3a8a; font-size: 16px; font-weight: 600; margin-top: 25px; margin-bottom: 10px;">Detalle de la Cotización</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                  <th style="padding: 8px; text-align: left; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569;">Concepto/Descripción</th>
                  <th style="padding: 8px; text-align: left; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569; width: 80px;">Cantidad</th>
                  <th style="padding: 8px; text-align: left; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569; width: 130px;">Subtotal/Importe</th>
                </tr>
              </thead>
              <tbody>
                ${conceptsHtmlRows}
              </tbody>
            </table>
            
            <p style="font-size: 15px; line-height: 1.6; color: #4b5563;">
              Para revisar el detalle completo, aceptar o rechazar esta cotización, por favor ingrese a nuestro portal. Si tiene alguna duda o requiere modificaciones, por favor contáctenos a través de nuestros canales oficiales.
            </p>
            
            <div style="margin-top: 35px; border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">Este es un correo automático enviado por <strong>GestorPyme</strong>.</p>
              <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} GestorPyme. Todos los derechos reservados.</p>
            </div>
          </div>
        `;

        await sendEmail({
          to: cot.cliente.email,
          subject: `Nueva Cotización ${cot.folio} - GestorPyme`,
          html: emailHtml
        });
      }
    }

    redirect(303, `/cotizaciones/${nueva.id}`);
  }
};
