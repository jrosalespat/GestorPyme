import { json } from '@sveltejs/kit';
import { TAVUS_GPYME_API_KEY, ANTHROPIC_API_KEY } from '$env/static/private';
import { prisma } from '$lib/server/prisma.js';

export async function POST(event) {
  try {
    // 1. Validar variables de entorno
    if (!TAVUS_GPYME_API_KEY || !ANTHROPIC_API_KEY) {
      console.error('[Webhook Tavus] Falta configurar TAVUS_GPYME_API_KEY o ANTHROPIC_API_KEY en el servidor.');
      return json({ error: 'Configuración incompleta' }, { status: 500 });
    }

    const body = await event.request.json();
    console.log('[Webhook Tavus] Payload recibido de Tavus:', JSON.stringify(body, null, 2));

    // 2. Extraer robustamente el conversation_id (en la raíz, data o event)
    const conversationId = body.conversation_id || 
                           body.data?.conversation_id || 
                           body.event?.conversation_id || 
                           body.properties?.conversation_id;

    const eventType = body.event_type || body.event || 'desconocido';

    if (!conversationId) {
      console.error('[Webhook Tavus] No se pudo extraer conversation_id del payload recibido.');
      return json({ error: 'Falta conversation_id en el cuerpo de la petición' }, { status: 400 });
    }

    console.log(`[Webhook Tavus] Evento identificado: "${eventType}" para la conversación: ${conversationId}`);

    // Definición de la lógica de procesamiento en segundo plano
    const processEvaluation = async () => {
      try {
        console.log(`[Webhook Tavus] [Fondo] Iniciando flujo de evaluación para: ${conversationId}`);

        // A. Obtener el escenario_id asociado a la conversación desde la base de datos
        console.log(`[Webhook Tavus] [Fondo] Buscando conversación ${conversationId} en la base de datos...`);
        const evaluations = await prisma.$queryRaw`
          SELECT escenario_id 
          FROM evaluaciones_cobranza 
          WHERE conversation_id = ${conversationId}
          LIMIT 1;
        `;

        if (!evaluations || evaluations.length === 0) {
          console.error(`[Webhook Tavus] [Fondo] [Error] No se encontró ningún registro pendiente en evaluaciones_cobranza para: ${conversationId}`);
          return;
        }

        const escenarioId = evaluations[0].escenario_id;
        console.log(`[Webhook Tavus] [Fondo] Registro encontrado. Escenario ID: ${escenarioId}`);

        // B. Obtener el system_prompt original del escenario
        console.log(`[Webhook Tavus] [Fondo] Recuperando system_prompt del escenario ${escenarioId}...`);
        const escenarios = await prisma.$queryRaw`
          SELECT system_prompt 
          FROM escenarios_cobranza 
          WHERE id = CAST(${escenarioId} AS uuid)
          LIMIT 1;
        `;

        if (!escenarios || escenarios.length === 0) {
          console.error(`[Webhook Tavus] [Fondo] [Error] No se encontró el escenario con ID: ${escenarioId}`);
          return;
        }

        const systemPrompt = escenarios[0].system_prompt;
        console.log(`[Webhook Tavus] [Fondo] System prompt del escenario recuperado exitosamente.`);

        // C. Obtener la transcripción de Tavus (con reintentos)
        console.log(`[Webhook Tavus] [Fondo] Solicitando transcripción a la API de Tavus...`);
        let transcriptText = '';
        let retries = 5;
        const delay = 3000;

        while (retries > 0) {
          const tavusResponse = await fetch(`https://tavusapi.com/v2/conversations/${conversationId}?verbose=true`, {
            method: 'GET',
            headers: {
              'x-api-key': TAVUS_GPYME_API_KEY
            }
          });

          if (!tavusResponse.ok) {
            const errorText = await tavusResponse.text();
            console.error('[Webhook Tavus] [Fondo] Error de API de Tavus:', errorText);
            break;
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
            break;
          }

          console.log(`[Webhook Tavus] [Fondo] Transcripción vacía. Reintentando en ${delay}ms... (Intentos restantes: ${retries - 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries--;
        }

        // 4. Validar transcripción
        if (!transcriptText || transcriptText.trim() === '') {
          console.warn(`[Webhook Tavus] [Fondo] [Advertencia] Transcripción vacía o indefinida para conversation_id: ${conversationId}. Se cancela la evaluación para no desperdiciar tokens de Claude.`);
          return;
        }

        console.log(`[Webhook Tavus] [Fondo] Transcripción obtenida con éxito (${transcriptText.split('\n').length} líneas).`);

        // D. Evaluar la conversación con Claude
        console.log(`[Webhook Tavus] [Fondo] Conectando con la API de Anthropic (Claude)...`);
        
        // 3. System prompt estricto indicando que retorne única y exclusivamente JSON
        const systemPromptForClaude = `Actúa como un gerente de cobranza experto y auditor de calidad corporativo. 
Tu tarea es evaluar el desempeño de un agente de cobranza (el "Cobrador") durante una simulación interactiva con un cliente deudor ficticio.

Recibirás:
1. El perfil y system prompt original que definía la personalidad e instrucciones del cliente deudor.
2. La transcripción de la llamada real entre el Cobrador y el Cliente (Avatar).

Evalúa el desempeño del Cobrador considerando:
- Empatía, respeto y tono profesional.
- Claridad al comunicar la deuda y el folio.
- Capacidad de negociación, firmeza y búsqueda de compromisos concretos de pago.

Devuelve ÚNICA Y EXCLUSIVAMENTE un objeto JSON válido en español, sin texto adicional, sin saludos y sin formato markdown. El JSON debe cumplir exactamente con esta estructura:
{
  "calificacion": <número entero del 1 al 100>,
  "feedback": "<comentarios detallados en español analizando aciertos, áreas de oportunidad y una recomendación práctica>"
}`;

        const userPromptForClaude = `Perfil del Deudor (Instrucciones Originales):
"""
${systemPrompt}
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
          console.error('[Webhook Tavus] [Fondo] Error al comunicarse con Anthropic Claude:', await anthropicResponse.text());
          return;
        }

        const claudeResult = await anthropicResponse.json();
        const claudeText = claudeResult.content?.[0]?.text || '';
        console.log('[Webhook Tavus] [Fondo] Respuesta cruda recibida de Claude:', claudeText);
        
        // 3. Limpieza de JSON de Claude usando Expresión Regular
        let cleanJsonText = claudeText.replace(/```json/g, '').replace(/```/g, '').trim();
        console.log('[Webhook Tavus] [Fondo] Respuesta limpia para parseo:', cleanJsonText);

        let evaluationResult;
        try {
          evaluationResult = JSON.parse(cleanJsonText);
        } catch (parseError) {
          console.error('[Webhook Tavus] [Fondo] [Error] Fallo al parsear JSON de Claude:', cleanJsonText, parseError);
          return;
        }

        const { calificacion, feedback } = evaluationResult;
        const califNum = parseInt(calificacion, 10);

        if (isNaN(califNum)) {
          console.error(`[Webhook Tavus] [Fondo] [Error] La calificación obtenida no es un entero válido: ${calificacion}`);
          return;
        }

        // E. Guardar en base de datos buscando por conversation_id
        console.log(`[Webhook Tavus] [Fondo] Guardando evaluación en Supabase. Calificación: ${califNum}...`);
        const updatedRows = await prisma.$executeRaw`
          UPDATE evaluaciones_cobranza
          SET calificacion = ${califNum},
              feedback_ia = ${feedback}
          WHERE conversation_id = ${conversationId};
        `;

        console.log(`[Webhook Tavus] [Fondo] Éxito. Filas actualizadas en DB: ${updatedRows} para la conversación: ${conversationId}`);
      } catch (bgError) {
        // 1. Error completo
        console.error('[Webhook Tavus] [Fondo] [Error Crítico] Ocurrió un error completo en el proceso de fondo:', bgError);
      }
    };

    // Usar event.waitUntil para plataformas Serverless que lo soporten
    if (event.waitUntil) {
      event.waitUntil(processEvaluation());
    } else {
      processEvaluation().catch(err => console.error('[Webhook Tavus] Error al lanzar tarea de fondo:', err));
    }

    // Responder inmediatamente a Tavus con status 200
    return json({ success: true, message: 'Webhook recibido y procesándose en segundo plano' });

  } catch (error) {
    // 1. Error completo
    console.error('[Webhook Tavus] [Error Crítico] Error completo en el controlador de entrada del webhook:', error);
    return json({ error: 'Error interno de servidor' }, { status: 500 });
  }
}
