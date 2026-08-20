import { json } from '@sveltejs/kit';
import { TAVUS_GPYME_API_KEY, ANTHROPIC_API_KEY } from '$env/static/private';
import { prisma } from '$lib/server/prisma.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
  try {
    // 1. Validar que las variables de entorno estén configuradas
    if (!TAVUS_GPYME_API_KEY || !ANTHROPIC_API_KEY) {
      return json({
        error: 'CONFIG_MISSING',
        message: 'Falta configurar TAVUS_GPYME_API_KEY o ANTHROPIC_API_KEY en el servidor.'
      }, { status: 500 });
    }

    // 2. Obtener datos de la petición
    const { conversation_id, escenario_id, system_prompt } = await request.json();

    if (!conversation_id || !escenario_id || !system_prompt) {
      return json({
        error: 'BAD_REQUEST',
        message: 'Faltan parámetros requeridos: conversation_id, escenario_id o system_prompt.'
      }, { status: 400 });
    }

    // ── Paso A: Obtener detalles y transcripción de Tavus (con mecanismo de reintentos) ──
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    let transcriptText = '';
    let retries = 5;
    let delay = 3000; // 3 segundos entre reintentos

    while (retries > 0) {
      const tavusResponse = await fetch(`https://tavusapi.com/v2/conversations/${conversation_id}?verbose=true`, {
        method: 'GET',
        headers: {
          'x-api-key': TAVUS_GPYME_API_KEY
        }
      });

      if (!tavusResponse.ok) {
        const errorText = await tavusResponse.text();
        console.error('Error al obtener conversación de Tavus:', errorText);
        return json({
          error: 'TAVUS_RETRIEVAL_ERROR',
          message: 'No se pudo obtener la información de la conversación desde Tavus.'
        }, { status: tavusResponse.status });
      }

      const tavusData = await tavusResponse.json();
      const rawTranscript = tavusData.properties?.transcript || tavusData.transcript;

      if (Array.isArray(rawTranscript) && rawTranscript.length > 0) {
        transcriptText = rawTranscript
          .map(t => `${t.role === 'user' ? 'Cobrador' : 'Cliente'}: ${t.content}`)
          .join('\n');
      } else if (typeof rawTranscript === 'string' && rawTranscript.trim() !== '') {
        transcriptText = rawTranscript;
      }

      if (transcriptText && transcriptText.trim() !== '') {
        break; // Éxito: tenemos la transcripción y tiene contenido
      }

      console.log(`[Tavus Evaluar] Transcripción vacía o no lista. Esperando ${delay}ms para reintentar... (${retries - 1} intentos restantes)`);
      await sleep(delay);
      retries--;
    }

    if (!transcriptText || transcriptText.trim() === '') {
      return json({
        error: 'EMPTY_TRANSCRIPT',
        message: 'La transcripción de la conversación está vacía o el procesamiento de Tavus aún no ha finalizado. Por favor, intenta de nuevo en unos momentos.'
      }, { status: 400 });
    }

    // ── Paso B: Evaluar la conversación con Anthropic Claude ────────────────
    const systemPromptForClaude = `Actúa como un gerente de cobranza experto y auditor de calidad corporativo. 
Tu tarea es evaluar el desempeño de un agente de cobranza (el "Cobrador") durante una simulación interactiva con un cliente deudor ficticio.

Recibirás:
1. El perfil y system prompt original que definía la personalidad e instrucciones del cliente deudor.
2. La transcripción de la llamada real entre el Cobrador y el Cliente (Avatar).

Evalúa el desempeño del Cobrador considerando:
- Empatía, respeto y tono profesional.
- Claridad al comunicar la deuda y el folio.
- Capacidad de negociación, firmeza y búsqueda de compromisos concretos de pago.

Debes responder ÚNICA y ESTRICTAMENTE con un objeto JSON válido en español. No incluyas explicaciones adicionales, texto introductorio, ni bloques de código markdown alrededor del JSON. El JSON debe cumplir exactamente con esta estructura:
{
  "calificacion": <número entero del 1 al 100>,
  "feedback": "<comentarios detallados en español analizando aciertos, áreas de oportunidad y una recomendación práctica>"
}`;

    const userPromptForClaude = `Perfil del Deudor (Instrucciones Originales):
"""
${system_prompt}
"""

Transcripción de la Simulación de Cobro:
"""
${transcriptText}
"""`;

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPromptForClaude,
        messages: [
          { role: 'user', content: userPromptForClaude }
        ]
      })
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error('Error de API Anthropic:', errorText);
      return json({
        error: 'CLAUDE_API_ERROR',
        message: 'Error al comunicarse con el evaluador de Inteligencia Artificial.'
      }, { status: anthropicResponse.status });
    }

    const claudeResult = await anthropicResponse.json();
    const claudeText = claudeResult.content?.[0]?.text || '';
    
    // Limpiar posibles bloques de código del markdown de Claude
    let cleanJsonText = claudeText.trim();
    if (cleanJsonText.startsWith('```')) {
      cleanJsonText = cleanJsonText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    }

    let evaluationResult;
    try {
      evaluationResult = JSON.parse(cleanJsonText);
    } catch (parseError) {
      console.error('Error al parsear JSON de Claude:', claudeText, parseError);
      return json({
        error: 'EVALUATION_PARSE_ERROR',
        message: 'La Inteligencia Artificial no devolvió un formato de evaluación válido.'
      }, { status: 500 });
    }

    const { calificacion, feedback } = evaluationResult;

    // ── Paso C: Guardar en la Base de Datos usando consulta cruda ──────────
    // Se inserta en 'evaluaciones_cobranza' que no está en el schema de Prisma
    try {
      await prisma.$executeRaw`
        INSERT INTO evaluaciones_cobranza (escenario_id, conversation_id, calificacion, feedback_ia)
        VALUES (CAST(${escenario_id} AS uuid), ${conversation_id}, ${Number(calificacion)}, ${feedback});
      `;
    } catch (dbError) {
      console.error('Error al guardar evaluación en la base de datos (Supabase):', dbError);
      // Continuamos para no bloquear la visualización del resultado al usuario final
    }

    // 10. Retornar el resultado al frontend
    return json({
      success: true,
      calificacion: Number(calificacion),
      feedback: feedback
    });

  } catch (error) {
    console.error('Error crítico en el endpoint de evaluación:', error);
    return json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Ocurrió un error inesperado al procesar la evaluación.'
    }, { status: 500 });
  }
}
