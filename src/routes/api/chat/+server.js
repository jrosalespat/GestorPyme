import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { prisma } from '$lib/server/prisma.js';
import { buildSystemPrompt } from '$lib/server/agentPrompt.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
  const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  
  // 1. Verificación de Autenticación con Clerk
  const auth = locals.auth();
  if (!auth?.userId) {
    return json({ error: 'No autorizado' }, { status: 401 });
  }

  // 2. Extraer cuerpo de la solicitud
  const { messages, currentPath, userDetails } = await request.json();

  if (!messages || !Array.isArray(messages)) {
    return json({ error: 'Historial de mensajes inválido' }, { status: 400 });
  }

  // 3. Validar presencia de la API Key de Anthropic
  if (!ANTHROPIC_API_KEY) {
    return json({
      error: 'API_KEY_MISSING',
      message: 'La variable de entorno ANTHROPIC_API_KEY no está configurada en el servidor. Por favor, añádela a tu archivo .env para poder chatear con el asistente.'
    }, { status: 500 });
  }

  try {
    // 4. Cargar datos clave del negocio en tiempo real (en paralelo)
    const [clientesCount, clientesList, cotizaciones, pagosSum, cotizacionesList, pagosList] = await Promise.all([
      prisma.cliente.count({ where: { activo: true } }),
      prisma.cliente.findMany({
        where: { activo: true },
        select: {
          id: true,
          nombre: true,
          empresa: true,
          email: true
        },
        take: 30
      }),
      prisma.cotizacion.findMany({
        select: { estado: true }
      }),
      prisma.pago.aggregate({
        _sum: { monto: true }
      }),
      prisma.cotizacion.findMany({
        select: {
          id: true,
          folio: true,
          total: true,
          estado: true,
          cliente: {
            select: {
              nombre: true
            }
          },
          fechaEmision: true
        },
        orderBy: { fechaEmision: 'desc' },
        take: 15
      }),
      prisma.pago.findMany({
        select: {
          id: true,
          monto: true,
          metodoPago: true,
          fechaPago: true,
          cotizacion: {
            select: {
              folio: true,
              cliente: {
                select: {
                  nombre: true
                }
              }
            }
          }
        },
        orderBy: { fechaPago: 'desc' },
        take: 10
      })
    ]);

    // 5. Formatear datos recopilados
    const totalCobrado = Number(pagosSum._sum.monto || 0);
    const totalCobradoFormatted = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(totalCobrado);

    const cotizacionesCountByEstado = cotizaciones.reduce((acc, c) => {
      acc[c.estado] = (acc[c.estado] || 0) + 1;
      return acc;
    }, {});

    const dbSummary = {
      clientesCount,
      totalCobradoFormatted,
      cotizacionesCountByEstado,
      clientesList,
      cotizacionesList: cotizacionesList.map(c => ({
        id: c.id,
        folio: c.folio,
        total: Number(c.total),
        estado: c.estado,
        cliente: c.cliente?.nombre,
        fechaEmision: c.fechaEmision
      })),
      pagosList: pagosList.map(p => ({
        id: p.id,
        monto: Number(p.monto),
        metodoPago: p.metodoPago,
        fechaPago: p.fechaPago,
        folioCotizacion: p.cotizacion?.folio,
        cliente: p.cotizacion?.cliente?.nombre
      }))
    };

    // 6. Construir el prompt de sistema inyectando el contexto
    const systemPrompt = buildSystemPrompt({
      dbSummary,
      currentPath,
      user: userDetails
    });

    // 7. Consumir la API de Anthropic (Claude)
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      })
    });

    // 8. Manejo de respuesta del proveedor de IA
    if (!anthropicResponse.ok) {
      const errorData = await anthropicResponse.json().catch(() => ({}));
      console.error('Error de API Anthropic:', errorData);
      return json({ 
        error: 'Claude API Error', 
        message: errorData.error?.message || 'Error desconocido en la API de Anthropic'
      }, { status: anthropicResponse.status });
    }

    const result = await anthropicResponse.json();
    const responseText = result.content?.[0]?.text || '';

    return json({ response: responseText });
  } catch (error) {
    console.error('Error interno en /api/chat:', error);
    return json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
