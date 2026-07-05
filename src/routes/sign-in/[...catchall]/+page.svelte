<script>
  import { SignIn } from 'svelte-clerk';
</script>

<svelte:head>
  <title>Iniciar sesión – GestorPyme</title>
  <meta name="description" content="Accede a tu cuenta de GestorPyme" />
</svelte:head>

<div class="sign-in-page">
  <div class="sign-in-branding">
    <div class="sign-in-logo">⚡</div>
    <h1 class="sign-in-title">GestorPyme</h1>
    <p class="sign-in-subtitle">Sistema de gestión para tu empresa</p>
  </div>

  <div class="sign-in-card">
    <!--
      path="/sign-in" le dice a Clerk cuál es la ruta base del componente.
      Esto es necesario para que el routing interno de Clerk (sso-callback,
      factor-one, factor-two, etc.) funcione correctamente en SvelteKit.
    -->
    <SignIn path="/sign-in" />
  </div>
</div>

<style>
  .sign-in-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 32px;
    padding: 24px;
    background:
      radial-gradient(ellipse 80% 60% at 50% -10%, rgba(108,99,255,.25) 0%, transparent 70%),
      #0f1117;
  }

  .sign-in-branding {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .sign-in-logo {
    font-size: 3rem;
    line-height: 1;
    filter: drop-shadow(0 0 20px rgba(108,99,255,.6));
    animation: float 3s ease-in-out infinite;
  }

  .sign-in-title {
    font-size: 2rem;
    font-weight: 800;
    background: linear-gradient(135deg, #6c63ff, #a78bfa, #f0f0f5);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.5px;
  }

  .sign-in-subtitle {
    color: #8b8fa8;
    font-size: 0.9rem;
  }

  .sign-in-card {
    width: 100%;
    max-width: 420px;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
</style>
