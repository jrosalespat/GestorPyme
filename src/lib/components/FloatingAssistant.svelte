<script>
  import { page } from '$app/stores';
  import { slide, fade } from 'svelte/transition';
  import { untrack } from 'svelte';

  // Recibimos los detalles del usuario logueado desde el layout
  let { user = null } = $props();

  // Estados reactivos (Runes Svelte 5)
  let isOpen = $state(false);
  let inputMessage = $state('');
  let messages = $state([]);
  let isLoading = $state(false);
  let errorMsg = $state('');
  let chatContainer = $state(null);

  // Sugerencias rápidas para el usuario
  const suggestions = [
    '¿Qué módulos tiene esta app?',
    '¿Cuántos clientes tengo?',
    '¿Cómo registro una cotización?',
    'Resumen de cobranza pendiente'
  ];

  // Inicialización y persistencia en sessionStorage
  $effect(() => {
    untrack(() => {
    const saved = sessionStorage.getItem('gp_assistant_chat');
    if (saved) {
      try {
        messages = JSON.parse(saved);
      } catch (e) {
        console.error('Error cargando historial de chat:', e);
      }
    }

    // Si está vacío, cargar mensaje de bienvenida
    if (messages.length === 0) {
      messages = [{
        role: 'assistant',
        content: `¡Hola! Soy el **Asistente Inteligente** de GestorPyme. ⚡\n\nTengo acceso de lectura a tus clientes, cotizaciones y cobros en tiempo real. Puedo ayudarte a responder dudas o llevarte a secciones del sistema.\n\n¿En qué puedo ayudarte hoy?`
      }];
    }
    });
  });

  // Efecto para guardar cambios en el historial
  $effect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('gp_assistant_chat', JSON.stringify(messages));
    }
  });

  // Auto-scroll al final del chat cuando se agregan mensajes
  $effect(() => {
    if (messages && chatContainer) {
      // Usar setTimeout para asegurar que el DOM se haya renderizado completamente
      setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 50);
    }
  });

  // Parseador de Markdown ultra liviano y seguro (escapa HTML nativo antes de procesar)
  function formatMarkdown(text) {
    if (!text) return '';
    
    // Escapar etiquetas HTML para evitar XSS
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Negritas **texto**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Cursivas *texto*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Código en línea `código`
    html = html.replace(/`(.*?)`/g, '<code class="chat-code">$1</code>');
    
    // Enlaces Markdown [Texto](/ruta) -> Enlaces relativos nativos
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="chat-link">$1</a>');
    
    // Saltos de línea
    html = html.replace(/\n/g, '<br>');
    
    return html;
  }

  // Enviar mensaje
  async function sendMessage(textToSend) {
    const text = textToSend?.trim() || inputMessage.trim();
    if (!text || isLoading) return;

    if (!textToSend) {
      inputMessage = '';
    }

    errorMsg = '';
    
    // Añadir mensaje del usuario al chat
    messages = [...messages, { role: 'user', content: text }];
    isLoading = true;

    // Obtener detalles del usuario Clerk formateados
    const userDetails = user ? {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.emailAddresses?.[0]?.emailAddress
    } : null;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messages,
          currentPath: $page.url.pathname, // Contexto de ruta
          userDetails: userDetails
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'API_KEY_MISSING') {
          throw new Error('ANTHROPIC_API_KEY no configurada. Por favor define esta variable en tu archivo .env del servidor.');
        }
        throw new Error(data.message || 'Error al comunicarse con el asistente');
      }

      // Añadir respuesta del asistente
      messages = [...messages, { role: 'assistant', content: data.response }];
    } catch (err) {
      console.error(err);
      errorMsg = err.message || 'Ocurrió un error inesperado.';
      messages = [...messages, { role: 'assistant', content: `❌ **Error:** ${errorMsg}` }];
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearHistory() {
    if (confirm('¿Deseas reiniciar la conversación?')) {
      messages = [{
        role: 'assistant',
        content: `¡Conversación reiniciada! ¿En qué otra cosa te puedo ayudar? ⚡`
      }];
      sessionStorage.removeItem('gp_assistant_chat');
    }
  }
</script>

<div class="assistant-wrapper">
  {#if isOpen}
    <!-- VENTANA DE CHAT -->
    <div class="chat-window" transition:slide={{ duration: 250 }}>
      <!-- Cabecera -->
      <div class="chat-header">
        <div class="header-info">
          <div class="status-dot"></div>
          <div>
            <h3>Asistente GestorPyme</h3>
            <span class="subtext">Claude 4.6 Sonnet activo</span>
          </div>
        </div>
        <div class="header-actions">
          <button onclick={clearHistory} class="action-btn" title="Reiniciar chat">
            🔄
          </button>
          <button onclick={() => isOpen = false} class="close-btn" title="Cerrar">
            ✖
          </button>
        </div>
      </div>

      <!-- Contenedor de Mensajes -->
      <div class="chat-messages" bind:this={chatContainer}>
        {#each messages as msg}
          <div class="message-row {msg.role}">
            {#if msg.role === 'assistant'}
              <div class="bot-avatar">⚡</div>
            {/if}
            <div class="message-bubble {msg.role}">
              {@html formatMarkdown(msg.content)}
            </div>
          </div>
        {/each}

        {#if isLoading}
          <div class="message-row assistant">
            <div class="bot-avatar">⚡</div>
            <div class="message-bubble assistant loading-bubble">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Sugerencias Rápidas -->
      {#if messages.length <= 2 && !isLoading}
        <div class="chat-suggestions">
          {#each suggestions as sug}
            <button onclick={() => sendMessage(sug)} class="suggestion-chip">
              {sug}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Formulario de Entrada -->
      <div class="chat-input-area">
        <textarea
          bind:value={inputMessage}
          onkeydown={handleKeydown}
          placeholder="Escribe tu mensaje aquí..."
          rows="1"
          disabled={isLoading}
        ></textarea>
        <button onclick={() => sendMessage()} disabled={!inputMessage.trim() || isLoading} class="send-btn">
          Enviar
        </button>
      </div>
    </div>
  {/if}

  <!-- BOTÓN FLOTANTE (BURBUJA) -->
  <button
    onclick={() => isOpen = !isOpen}
    class="assistant-trigger-btn"
    class:active={isOpen}
    title="Asistente de Inteligencia Artificial"
  >
    {#if isOpen}
      <span class="icon-close">💬</span>
    {:else}
      <span class="icon-bot">⚡</span>
      <span class="pulse-ring"></span>
    {/if}
  </button>
</div>

<style>
  /* Envoltorio principal */
  .assistant-wrapper {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 1000;
    font-family: 'Inter', system-ui, sans-serif;
  }

  /* BOTÓN BURBUJA FLOTANTE */
  .assistant-trigger-btn {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), #8b5cf6);
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(108, 99, 255, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-size: 1.5rem;
    position: relative;
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s;
  }

  .assistant-trigger-btn:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 24px rgba(108, 99, 255, 0.6);
  }

  .assistant-trigger-btn:active {
    transform: scale(0.95);
  }

  .assistant-trigger-btn.active {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-md);
    color: var(--text-primary);
  }

  /* Anillo de pulso animado para atraer la atención */
  .pulse-ring {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid var(--accent);
    animation: pulse-ring-anim 2s infinite;
    pointer-events: none;
    box-sizing: border-box;
  }

  @keyframes pulse-ring-anim {
    0% {
      transform: scale(0.95);
      opacity: 0.8;
    }
    100% {
      transform: scale(1.6);
      opacity: 0;
    }
  }

  /* VENTANA DE CHAT */
  .chat-window {
    position: absolute;
    bottom: 72px;
    right: 0;
    width: 380px;
    height: 520px;
    max-width: calc(100vw - 48px);
    max-height: calc(100vh - 120px);
    background: rgba(26, 29, 39, 0.9);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: all 0.3s ease;
  }

  /* Cabecera del Chat */
  .chat-header {
    padding: 14px 16px;
    background: rgba(34, 38, 58, 0.5);
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    background-color: var(--success);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--success);
  }

  .chat-header h3 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .chat-header .subtext {
    font-size: 0.7rem;
    color: var(--text-secondary);
    display: block;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .header-actions button {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.9rem;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s;
  }

  .header-actions button:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-primary);
  }

  /* Mensajes */
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .message-row {
    display: flex;
    gap: 8px;
    max-width: 85%;
  }

  .message-row.user {
    align-self: flex-end;
    justify-content: flex-end;
  }

  .message-row.assistant {
    align-self: flex-start;
  }

  .bot-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), #8b5cf6);
    color: #ffffff;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .message-bubble {
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 0.875rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .message-bubble.user {
    background: var(--accent);
    color: #ffffff;
    border-bottom-right-radius: 2px;
    box-shadow: 0 2px 8px rgba(108, 99, 255, 0.2);
  }

  .message-bubble.assistant {
    background: var(--bg-elevated);
    color: var(--text-primary);
    border-bottom-left-radius: 2px;
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  /* Sugerencias Rápidas */
  .chat-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .suggestion-chip {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    border-radius: 14px;
    padding: 6px 12px;
    font-size: 0.75rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
  }

  .suggestion-chip:hover {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--text-primary);
  }

  /* Área de Entrada */
  .chat-input-area {
    padding: 12px 16px;
    background: rgba(26, 29, 39, 0.95);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .chat-input-area textarea {
    flex: 1;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-primary);
    padding: 10px 12px;
    font-size: 0.875rem;
    resize: none;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }

  .chat-input-area textarea:focus {
    border-color: var(--accent);
  }

  .chat-input-area textarea::placeholder {
    color: var(--text-secondary);
  }

  .send-btn {
    background: var(--accent);
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s, opacity 0.2s;
  }

  .send-btn:hover {
    background: var(--accent-hover);
  }

  .send-btn:disabled {
    background: var(--bg-elevated);
    color: var(--text-secondary);
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Burbuja de Carga */
  .loading-bubble {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 16px;
  }

  .loading-bubble .dot {
    width: 6px;
    height: 6px;
    background: var(--text-secondary);
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
  }

  .loading-bubble .dot:nth-child(1) { animation-delay: -0.32s; }
  .loading-bubble .dot:nth-child(2) { animation-delay: -0.16s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1.0); }
  }

  /* Estilos globales inyectados en HTML parseado del markdown */
  :global(.chat-link) {
    color: #a78bfa !important;
    text-decoration: underline;
    font-weight: 600;
    transition: color 0.15s;
  }
  :global(.chat-link:hover) {
    color: var(--accent-hover) !important;
  }

  :global(.chat-code) {
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.8rem;
    color: #f472b6;
  }
</style>
