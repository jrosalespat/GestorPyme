<script>
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>Dashboard – GestorPyme</title>
</svelte:head>

<div class="dashboard">
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon">📄</div>
      <div class="stat-info">
        <span class="stat-label">Cotizaciones activas</span>
        <span class="stat-value">—</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">👥</div>
      <div class="stat-info">
        <span class="stat-label">Clientes registrados</span>
        <span class="stat-value">—</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">💰</div>
      <div class="stat-info">
        <span class="stat-label">Por cobrar</span>
        <span class="stat-value">—</span>
      </div>
    </div>
    <div class="stat-card accent">
      <div class="stat-icon">✅</div>
      <div class="stat-info">
        <span class="stat-label">Cobrado este mes</span>
        <span class="stat-value">—</span>
      </div>
    </div>
  </div>

  <p class="empty-hint">Conecta tu base de datos en <code>.env</code> para comenzar.</p>
</div>

<style>
  .dashboard { display: flex; flex-direction: column; gap: 24px; }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }

  .stat-card {
    background: #1a1d27;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    transition: transform .2s, box-shadow .2s;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,.4);
  }

  .stat-card.accent { border-color: rgba(108,99,255,.4); background: rgba(108,99,255,.1); }

  .stat-icon { font-size: 1.75rem; }

  .stat-info { display: flex; flex-direction: column; gap: 2px; }

  .stat-label { font-size: 0.75rem; color: #8b8fa8; font-weight: 500; }
  .stat-value { font-size: 1.5rem; font-weight: 700; color: #f0f0f5; }

  .empty-hint {
    color: #8b8fa8;
    font-size: 0.875rem;
    text-align: center;
    padding: 32px;
    border: 1px dashed rgba(255,255,255,.1);
    border-radius: 12px;
  }

  code { background: rgba(108,99,255,.2); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: #a78bfa; }
</style>
