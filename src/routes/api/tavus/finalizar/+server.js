import { json } from '@sveltejs/kit';
import { TAVUS_GPYME_API_KEY } from '$env/static/private';

export async function POST({ request }) {
  try {
    const { conversation_id } = await request.json();

    if (!conversation_id) {
      return json({ error: 'Falta conversation_id en el cuerpo de la petición' }, { status: 400 });
    }

    console.log(`[Tavus Finalizar] Solicitando terminación de la sesión para: ${conversation_id}`);

    const response = await fetch(`https://tavusapi.com/v2/conversations/${conversation_id}/end`, {
      method: 'POST',
      headers: {
        'x-api-key': TAVUS_GPYME_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Tavus Finalizar] Tavus API respondió con error al finalizar la llamada: ${errorText}`);
    } else {
      console.log(`[Tavus Finalizar] Sesión finalizada con éxito en Tavus API.`);
    }

    // Retorna 200 siempre para no bloquear el flujo del frontend
    return json({ success: true });
  } catch (error) {
    console.error('[Tavus Finalizar] Error controlado al finalizar la llamada de Tavus:', error);
    return json({ success: true, error: error.message });
  }
}
