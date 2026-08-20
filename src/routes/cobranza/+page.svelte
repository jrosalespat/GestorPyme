<script>
  import { enhance } from '$app/forms';
  import { ESTADO_CONFIG } from '$lib/schemas/cotizacion.js';
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';

  let { data, form } = $props();

  // ── Historial de Evaluaciones y Polling ──
  let historialEvaluaciones = $state([]);
  $effect(() => {
    historialEvaluaciones = data.historialEvaluaciones ?? [];
  });

  let isRefreshing = $state(false);
  async function refrescarHistorial() {
    isRefreshing = true;
    try {
      await invalidateAll();
      const res = await fetch('/api/tavus/historial');
      if (res.ok) {
        const body = await res.json();
        if (body.evaluations) {
          historialEvaluaciones = body.evaluations;
        }
      }
    } catch (err) {
      console.error('Error al refrescar historial:', err);
    } finally {
      isRefreshing = false;
    }
  }

  onMount(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/tavus/historial');
        if (res.ok) {
          const body = await res.json();
          if (body.evaluations) {
            historialEvaluaciones = body.evaluations;
          }
        }
      } catch (err) {
        console.error('Error en polling de historial:', err);
      }
    }, 30000); // Cada 30 segundos

    return () => clearInterval(interval);
  });

  // ── Toast ────────────────────────────────
  let flash = $state('');
  let flashId = $state(''); // ID de la cotización que acaba de recibir recordatorio
  $effect(() => {
    if (form?.success && form?.flash) {
      flash = form.flash;
      flashId = form.recordatorioId ?? '';
      setTimeout(() => { flash = ''; flashId = ''; }, 4000);
    }
  });

  // ── Helpers ──────────────────────────────
  function mxn(v) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN', maximumFractionDigits: 2
    }).format(v ?? 0);
  }

  // Formato de fecha
  function fmt(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  // Formato de fecha para historial de evaluaciones
  function fmtEvalDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Color de urgencia según días transcurridos
  function urgenciaClass(dias) {
    if (dias > 30) return 'urgente';
    if (dias > 15) return 'alerta';
    return '';
  }

  function urgenciaLabel(dias) {
    if (dias > 30) return 'Vencida';
    if (dias > 15) return 'Próxima';
    return 'Al corriente';
  }

  // Contadores de urgencia
  let cntVencidas = $derived(data.cartera.filter(c => c.diasTranscurridos > 30).length);
  let cntAlertas  = $derived(data.cartera.filter(c => c.diasTranscurridos > 15 && c.diasTranscurridos <= 30).length);
  let cntAlDia    = $derived(data.cartera.filter(c => c.diasTranscurridos <= 15).length);

  function urgenciaColor(dias) {
    if (dias > 30) return '#f87171';
    if (dias > 15) return '#fbbf24';
    return '#34d399';
  }

  // ── Tavus Avatar Simulation & Evaluation States ──
  let isTrainingModalOpen = $state(false);
  let isLoading = $state(false);
  let tavusUrl = $state(null);
  let currentConversationId = $state(null);
  let simulationTitle = $state('');
  let tavusError = $state('');

  // Estados de evaluación (ahora asíncronos)
  let isEvaluating = $state(false);
  let evaluationResult = $state(null);
  let escenarioId = $state(null);
  let systemPrompt = $state(null);

  async function iniciarEntrenamiento() {
    isLoading = true;
    tavusError = '';
    isTrainingModalOpen = true;
    tavusUrl = null;
    currentConversationId = null;
    simulationTitle = 'Iniciando Simulación...';
    
    // Limpiar estados de evaluación anteriores
    evaluationResult = null;
    isEvaluating = false;
    escenarioId = null;
    systemPrompt = null;

    try {
      const res = await fetch('/api/tavus/iniciar-simulacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al iniciar simulación.');
      }

      const responseData = await res.json();
      tavusUrl = responseData.conversation_url;
      currentConversationId = responseData.conversation_id;
      simulationTitle = responseData.titulo || 'Simulación de Cobranza';
      escenarioId = responseData.escenario_id;
      systemPrompt = responseData.system_prompt;
    } catch (err) {
      console.error(err);
      tavusError = err.message || 'Error al conectar con el servidor de Tavus.';
      simulationTitle = 'Error';
    } finally {
      isLoading = false;
    }
  }

  async function cerrarEntrenamiento() {
    if (!currentConversationId) {
      resetearTodo();
      return;
    }

    resetearTodo();
    
    flash = "¡Práctica finalizada! La IA está analizando tu desempeño en segundo plano. Podrás ver tus resultados en unos minutos.";
    setTimeout(() => { flash = ''; }, 6000);

    // Refrescar para que aparezca el registro con estado "pendiente/procesando"
    await invalidateAll();
  }

  function resetearTodo() {
    isTrainingModalOpen = false;
    isLoading = false;
    isEvaluating = false;
    tavusUrl = null;
    currentConversationId = null;
    simulationTitle = '';
    tavusError = '';
    evaluationResult = null;
    escenarioId = null;
    systemPrompt = null;
  }
</script>

<svelte:head><title>Cobranza – GestorPyme</title></svelte:head>

<!-- Toast -->
{#if flash}
  <div class="toast">✅ {flash}</div>
{/if}

{#if form?.error}
  <div class="banner-error">{form.error}</div>
{/if}

<!-- ── Header ──────────────────────────────── -->
<div class="pg-header">
  <div>
    <h2 class="pg-title">Cartera de cobranza</h2>
    <p class="pg-sub">
      {data.cartera.length} cuenta{data.cartera.length !== 1 ? 's' : ''} por cobrar
    </p>
  </div>
  <div class="cartera-total">
    <span class="cartera-label">Cartera pendiente total</span>
    <span class="cartera-monto">{mxn(data.totalCartera)}</span>
  </div>
</div>

<!-- ── Badges de resumen ────────────────────── -->
<div class="resumen-bar">
  <div class="resumen-chip urgente">
    <span class="chip-num">{cntVencidas}</span>
    <span class="chip-label">Más de 30 días</span>
  </div>
  <div class="resumen-chip alerta">
    <span class="chip-num">{cntAlertas}</span>
    <span class="chip-label">15–30 días</span>
  </div>
  <div class="resumen-chip ok">
    <span class="chip-num">{cntAlDia}</span>
    <span class="chip-label">Menos de 15 días</span>
  </div>
</div>


<!-- ── Tabla ───────────────────────────────── -->
{#if data.cartera.length === 0}
  <div class="empty-state">
    <span>🎉</span>
    <p>¡Sin cuentas pendientes!</p>
    <span class="empty-sub">Todas las cotizaciones enviadas están al corriente.</span>
  </div>
{:else}
  <div class="table-wrap">
      <table class="cartera-table">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Folio</th>
          <th>Estado</th>
          <th>Emisión</th>
          <th>Vence</th>
          <th>Total</th>
          <th>Pagado</th>
          <th>Pendiente</th>
          <th>Días</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each data.cartera as c (c.id)}
          {@const urg = urgenciaClass(c.diasTranscurridos)}
          {@const cfg = ESTADO_CONFIG[c.estado]}
          <tr class={urg}>
            <td>
              <a href="/clientes/{c.cliente.id}" class="link">{c.cliente.nombre}</a>
              {#if c.cliente.empresa}
                <span class="sub">{c.cliente.empresa}</span>
              {/if}
            </td>
            <td>
              <a href="/cotizaciones/{c.id}" class="link folio">{c.folio}</a>
            </td>
            <td>
              <span class="badge"
                style="color:{cfg?.color}; background:{cfg?.bg}; border-color:{cfg?.border}">
                {cfg?.label ?? c.estado}
              </span>
            </td>
            <td>{fmt(c.fechaEmision)}</td>
            <td class:text-warn={c.diasTranscurridos > 30}>{fmt(c.fechaVence)}</td>
            <td class="mono">{mxn(c.total)}</td>
            <td class="mono cobrado">{mxn(c.cobrado)}</td>
            <td class="mono">
              <strong style="color:{urgenciaColor(c.diasTranscurridos)}">
                {mxn(c.saldoPendiente)}
              </strong>
            </td>
            <td>
              <span class="dias-badge" class:dias-urg={c.diasTranscurridos > 30} class:dias-alerta={c.diasTranscurridos > 15 && c.diasTranscurridos <= 30}>
                {c.diasTranscurridos}d
              </span>
            </td>
            <td>
              <form method="POST" action="?/enviarRecordatorio" use:enhance>
                <input type="hidden" name="cotizacionId"  value={c.id} />
                <input type="hidden" name="emailCliente"  value={c.cliente.email} />
                <input type="hidden" name="nombreCliente" value={c.cliente.nombre} />
                <input type="hidden" name="folio"         value={c.folio} />
                <input type="hidden" name="pendiente"     value={c.saldoPendiente} />
                <button
                  type="submit"
                  class="btn-recordatorio"
                  class:sent={flashId === c.id}
                  title="Enviar recordatorio de pago"
                >
                  {flashId === c.id ? '✅ Enviado' : '📧 Recordatorio'}
                </button>
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<!-- Banner de Simulación de Avatar IA -->
<div class="my-10 py-6 px-8 rounded-2xl bg-gradient-to-r from-violet-950/40 via-indigo-950/30 to-violet-950/40 border border-violet-500/15 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-indigo-950/20 relative overflow-hidden backdrop-blur-md">
  <!-- Efecto de luz de fondo sutil -->
  <div class="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl pointer-events-none"></div>
  <div class="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

  <div class="relative z-10 text-center md:text-left">
    <h3 class="text-white font-bold text-base flex items-center justify-center md:justify-start gap-2.5">
      <span class="text-xl">🤖</span> Centro de Entrenamiento de Cobranza
    </h3>
    <p class="text-xs text-violet-200/70 mt-1 max-w-xl">
      Mejora tus técnicas de cobro negociando cara a cara con nuestro Avatar de IA Ang. Al finalizar la llamada, Claude analizará tu empatía, claridad y capacidad de acuerdo en segundo plano.
    </p>
  </div>

  <div class="relative z-10 shrink-0">
    <button
      onclick={iniciarEntrenamiento}
      class="bg-gradient-to-r from-violet-500 via-purple-600 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center gap-2 border border-violet-400/20 group"
    >
      <span class="text-base group-hover:rotate-12 transition-transform duration-200">🗣️</span> Invocar al Avatar Ang de cobranza
    </button>
  </div>
</div>

<!-- 📊 Mis Prácticas de Cobranza -->
<div class="mt-8 mb-8 bg-[#1a1d27]/40 border border-white/5 rounded-2xl p-6">
  <div class="flex items-center justify-between pb-4 border-b border-white/5">
    <h3 class="text-base font-bold text-white flex items-center gap-2">
      <span>📊</span> Mis Prácticas de Cobranza
    </h3>
    <button
      onclick={refrescarHistorial}
      disabled={isRefreshing}
      class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {#if isRefreshing}
        <span class="w-3 h-3 border-2 border-gray-400/30 border-t-gray-300 rounded-full animate-spin"></span>
        Refrescando...
      {:else}
        <span>🔄</span> Refrescar resultados
      {/if}
    </button>
  </div>

  <div class="mt-4 space-y-4">
    {#if historialEvaluaciones.length === 0}
      <div class="flex flex-col items-center justify-center py-10 text-center text-gray-400">
        <span class="text-3xl mb-2">🤖</span>
        <p class="font-medium text-sm text-gray-300">Aún no tienes prácticas evaluadas.</p>
        <p class="text-xs text-gray-500 mt-1">¡Anímate a entrenar con el Avatar Ang presionando el botón de arriba!</p>
      </div>
    {:else}
      {#each historialEvaluaciones as ev (ev.id)}
        <div class="bg-[#12141c]/60 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all duration-200">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h4 class="font-bold text-white text-sm">{ev.escenario_titulo || 'Escenario sin título'}</h4>
              <p class="text-xs text-gray-500 mt-0.5">Realizada el {fmtEvalDate(ev.fecha_practica)}</p>
            </div>
            <div>
              {#if ev.calificacion === null}
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  ⏳ Procesando...
                </span>
              {:else}
                {@const score = Number(ev.calificacion)}
                {#if score >= 80}
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    ⭐ {score} / 100
                  </span>
                {:else}
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                    ⚠️ {score} / 100
                  </span>
                {/if}
              {/if}
            </div>
          </div>

          {#if ev.feedback_ia}
            <div class="mt-3 text-xs text-gray-300 bg-white/[0.01] border border-white/5 rounded-lg p-3 leading-relaxed">
              <span class="text-white font-semibold block mb-1">💡 Feedback del Asistente:</span>
              {ev.feedback_ia}
            </div>
          {:else if ev.calificacion === null}
            <div class="mt-3 text-xs text-gray-500 italic bg-white/[0.01] border border-white/5 rounded-lg p-3 leading-relaxed">
              La IA está evaluando tu llamada. Por favor, espera unos minutos o presiona el botón "Refrescar resultados".
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<!-- Modal de Entrenamiento con Avatar de IA -->
{#if isTrainingModalOpen}
  <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
    <div class="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col">
      <!-- Encabezado del modal -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🤖</span>
          <div>
            <h3 class="text-lg font-bold text-white leading-tight">
              {simulationTitle}
            </h3>
            <p class="text-xs text-gray-400 mt-0.5">
              Interactúa cara a cara con nuestro cliente simulado por IA
            </p>
          </div>
        </div>
        {#if !isEvaluating && !evaluationResult && !tavusError && !isLoading && currentConversationId}
          <button
            onclick={cerrarEntrenamiento}
            class="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Finalizar y Evaluar
          </button>
        {/if}
      </div>

      <!-- Cuerpo del modal -->
      <div class="p-6 flex-1 min-h-[400px] flex flex-col justify-center items-center">
        {#if isLoading}
          <div class="flex flex-col items-center gap-4 py-16">
            <div class="w-12 h-12 border-4 border-violet-600/30 border-t-violet-500 rounded-full animate-spin"></div>
            <div class="text-center">
              <p class="text-white font-medium text-base">Iniciando sesión con el avatar de IA...</p>
              <p class="text-gray-400 text-xs mt-1">Conectando a la sala de simulación de cobro. Esto puede tomar unos segundos.</p>
            </div>
          </div>
        {:else if isEvaluating}
          <div class="flex flex-col items-center gap-4 py-16">
            <div class="w-12 h-12 border-4 border-emerald-600/30 border-t-emerald-500 rounded-full animate-spin"></div>
            <div class="text-center">
              <p class="text-white font-medium text-base">Analizando la práctica con IA...</p>
              <p class="text-gray-400 text-xs mt-1">Claude está recuperando la transcripción de Tavus y auditando tu llamada.</p>
            </div>
          </div>
        {:else if evaluationResult}
          <div class="w-full max-w-2xl bg-black/30 border border-white/5 rounded-xl p-8 flex flex-col items-center gap-6">
            <div class="text-center">
              <h4 class="text-gray-400 text-xs uppercase tracking-wider font-semibold">Calificación Obtenida</h4>
              <div class="text-6xl font-black mt-2 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                {evaluationResult.calificacion} / 100
              </div>
            </div>
            
            <div class="w-full border-t border-white/10 pt-6">
              <h5 class="text-white font-bold text-sm mb-2">Feedback Detallado de la IA:</h5>
              <div class="bg-white/[0.02] border border-white/5 rounded-lg p-4 text-sm text-gray-300 leading-relaxed max-h-[250px] overflow-y-auto">
                {evaluationResult.feedback}
              </div>
            </div>

            <button
              onclick={resetearTodo}
              class="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 transition-all duration-200 cursor-pointer text-center text-sm"
            >
              Cerrar y Regresar
            </button>
          </div>
        {:else if tavusError}
          <div class="text-center py-12 max-w-md">
            <span class="text-4xl">⚠️</span>
            <h4 class="text-white font-semibold text-lg mt-3">Error</h4>
            <p class="text-red-400 text-sm mt-2">{tavusError}</p>
            <button
              onclick={resetearTodo}
              class="mt-6 bg-white/10 hover:bg-white/15 text-white text-sm px-5 py-2.5 rounded-xl border border-white/10 transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        {:else if tavusUrl}
          <div class="w-full h-[600px] rounded-xl overflow-hidden border border-white/10 bg-black/40">
            <iframe
              src={tavusUrl}
              allow="camera; microphone; fullscreen"
              class="w-full h-full border-0"
              title="Simulación de Cliente Tavus"
            ></iframe>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
/* ── Header ─────────────────── */
.pg-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.pg-title  { font-size: 1.25rem; font-weight: 700; color: #f0f0f5; }
.pg-sub    { font-size: 0.8rem; color: #8b8fa8; margin-top: 2px; }

.cartera-total { text-align: right; }
.cartera-label { display: block; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8b8fa8; margin-bottom: 4px; }
.cartera-monto { font-size: 1.6rem; font-weight: 700; color: #f87171; }

/* ── Resumen bar ─────────────── */
.resumen-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.resumen-chip {
  display: flex; align-items: center; gap: 10px;
  background: #1a1d27; border: 1px solid rgba(255,255,255,.08);
  border-radius: 10px; padding: 12px 16px; flex: 1; min-width: 120px;
}
.resumen-chip.urgente { border-color: rgba(248,113,113,.3); background: rgba(248,113,113,.05); }
.resumen-chip.alerta  { border-color: rgba(251,191,36,.3);  background: rgba(251,191,36,.05); }
.resumen-chip.ok      { border-color: rgba(52,211,153,.3);  background: rgba(52,211,153,.05); }
.chip-num   { font-size: 1.5rem; font-weight: 700; color: #f0f0f5; }
.chip-label { font-size: 0.75rem; color: #8b8fa8; }
.resumen-chip.urgente .chip-num { color: #f87171; }
.resumen-chip.alerta  .chip-num { color: #fbbf24; }
.resumen-chip.ok      .chip-num { color: #34d399; }

/* ── Table ───────────────────── */
.table-wrap { background: #1a1d27; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; overflow-x: auto; max-width: 100%; }
.cartera-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.cartera-table thead tr { background: rgba(255,255,255,.03); border-bottom: 1px solid rgba(255,255,255,.08); }
.cartera-table th { text-align: left; padding: 11px 14px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8b8fa8; }
.cartera-table td { padding: 11px 14px; color: #d4d4e8; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: middle; }
.cartera-table tr:last-child td { border-bottom: none; }

/* Filas urgentes */
.cartera-table tr.urgente { background: rgba(248,113,113,.04); }
.cartera-table tr.urgente:hover { background: rgba(248,113,113,.08); }
.cartera-table tr.alerta  { background: rgba(251,191,36,.03); }
.cartera-table tr.alerta:hover  { background: rgba(251,191,36,.07); }
.cartera-table tbody tr:not(.urgente):not(.alerta):hover { background: rgba(255,255,255,.02); }

.link { color: #a78bfa; text-decoration: none; }
.link:hover { text-decoration: underline; }
.link.folio { font-weight: 600; }
.sub { display: block; font-size: 0.72rem; color: #8b8fa8; margin-top: 1px; }
.mono { font-family: 'Courier New', monospace; font-size: 0.82rem; }
.cobrado { color: #34d399; }
.text-warn { color: #f87171; }

.badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; border: 1px solid; }

/* Días badge */
.dias-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; background: rgba(52,211,153,.12); color: #34d399; border: 1px solid rgba(52,211,153,.25); }
.dias-badge.dias-alerta { background: rgba(251,191,36,.12); color: #fbbf24; border-color: rgba(251,191,36,.3); }
.dias-badge.dias-urg    { background: rgba(248,113,113,.12); color: #f87171; border-color: rgba(248,113,113,.3); }

/* Botón recordatorio */
.btn-recordatorio {
  background: rgba(108,99,255,.12); color: #a78bfa;
  border: 1px solid rgba(108,99,255,.3); border-radius: 7px;
  padding: 5px 10px; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; white-space: nowrap; transition: all .2s;
}
.btn-recordatorio:hover { background: rgba(108,99,255,.25); color: #c4b5fd; }
.btn-recordatorio.sent { background: rgba(34,197,94,.1); color: #4ade80; border-color: rgba(34,197,94,.3); }

/* Empty state */
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 72px 24px; color: #8b8fa8; }
.empty-state span:first-child { font-size: 3rem; }
.empty-state p { font-size: 1rem; font-weight: 600; color: #f0f0f5; margin: 0; }
.empty-sub { font-size: 0.85rem; }

/* Banner error / toast */
.banner-error { background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.3); color: #fca5a5; border-radius: 8px; padding: 10px 16px; font-size: 0.875rem; margin-bottom: 16px; }
.toast { position: fixed; bottom: 24px; right: 24px; background: #22c55e; color: #fff; padding: 12px 20px; border-radius: 10px; font-size: 0.875rem; font-weight: 600; box-shadow: 0 4px 24px rgba(0,0,0,.4); z-index: 1000; animation: slideUp .25s ease; }
@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
</style>
