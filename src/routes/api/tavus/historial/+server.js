import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma.js';

export async function GET(event) {
  try {
    const auth = typeof event.locals.auth === 'function' ? event.locals.auth() : null;
    const userId = auth?.userId;

    if (!userId) {
      return json({ error: 'No autorizado' }, { status: 401 });
    }

    const evaluations = await prisma.$queryRaw`
      SELECT e.id, e.calificacion, e.feedback_ia, e.fecha_practica, e.conversation_id, c.titulo as escenario_titulo
      FROM evaluaciones_cobranza e
      JOIN escenarios_cobranza c ON e.escenario_id = c.id
      WHERE e.usuario_id = ${userId}
      ORDER BY e.fecha_practica DESC
      LIMIT 5;
    `;

    return json({ evaluations });
  } catch (error) {
    console.error('[API Tavus Historial] Error:', error);
    return json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
