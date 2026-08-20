import { json } from '@sveltejs/kit';
// Importamos tus llaves seguras desde el entorno privado de SvelteKit
import { TAVUS_GPYME_API_KEY, PAL_ID } from '$env/static/private';
// Importamos tu cliente Prisma existente
import { prisma } from '$lib/server/prisma.js';

export async function POST({ locals, url }) {
  try {
    const auth = typeof locals.auth === 'function' ? locals.auth() : null;
    const userId = auth?.userId ?? null;

    // 1. Obtenemos un escenario aleatorio directo de Supabase usando query crudo de Prisma
    const escenarios = await prisma.$queryRaw`
            SELECT id, titulo, system_prompt 
            FROM escenarios_cobranza 
            ORDER BY RANDOM() 
            LIMIT 1;
        `;

    if (!escenarios || escenarios.length === 0) {
      return json({ error: 'No hay escenarios configurados.' }, { status: 404 });
    }
    const escenario = escenarios[0];

    const callbackUrl = `${url.origin}/api/webhooks/tavus`;

    // 2. Llamamos a la API de Tavus (usando fetch nativo de Node)
    const response = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: {
        'x-api-key': TAVUS_GPYME_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        persona_id: PAL_ID,
        conversation_name: "Cliente Evasivo",
        conversational_context: escenario.system_prompt,
        callback_url: "https://gestorpyme.onrender.com/api/webhooks/tavus"
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Error de Tavus:", errorData);
      return json({ error: 'Error al conectar con Tavus' }, { status: 500 });
    }

    const data = await response.json();

    // 3. Guardar registro inicial en la base de datos
    try {
      await prisma.$executeRaw`
        INSERT INTO evaluaciones_cobranza (escenario_id, conversation_id, usuario_id)
        VALUES (CAST(${escenario.id} AS uuid), ${data.conversation_id}, ${userId});
      `;
    } catch (dbError) {
      console.error("Error al registrar simulación inicial en DB:", dbError);
    }

    // 4. Devolvemos la URL al frontend
    return json({
      conversation_url: data.conversation_url,
      conversation_id: data.conversation_id,
      escenario_id: escenario.id,
      titulo: escenario.titulo,
      system_prompt: escenario.system_prompt
    });

  } catch (error) {
    console.error("Error en el endpoint de Tavus:", error);
    return json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}