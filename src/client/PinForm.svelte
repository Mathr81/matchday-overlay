<script lang="ts">
  import { login } from './connection';

  // Écran de saisie du code PIN ; `onok` est appelé une fois le jeton enregistré sur l'appareil.
  let { onok }: { onok: () => void } = $props();
  let pin = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(ev: SubmitEvent) {
    ev.preventDefault();
    busy = true;
    error = await login(pin);
    busy = false;
    if (!error) onok();
    else pin = '';
  }
</script>

<form onsubmit={submit}>
  <h1>Code PIN</h1>
  <p>Il est affiché dans la console du serveur, sur le PC de régie.</p>
  <!-- svelte-ignore a11y_autofocus -->
  <input bind:value={pin} inputmode="numeric" autocomplete="off" maxlength="8" autofocus aria-label="Code PIN" />
  <button disabled={busy || !pin}>Entrer</button>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</form>

<style>
  :global(html) {
    background: #0a0a0a;
    color: #f3eee4;
    font: 16px/1.3 system-ui, sans-serif;
  }
  form {
    max-width: 320px;
    margin: 18vh auto 0;
    padding: 0 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
  h1 {
    margin: 0;
    font-size: 26px;
  }
  p {
    margin: 0;
    color: #a09a8e;
    font-size: 14px;
  }
  input {
    font: inherit;
    font-size: 34px;
    font-weight: 800;
    letter-spacing: 0.3em;
    text-align: center;
    color: inherit;
    background: #1c1c1e;
    border: 1px solid #333336;
    border-radius: 10px;
    padding: 14px 8px;
  }
  button {
    font: inherit;
    font-weight: 800;
    min-height: 56px;
    border: 0;
    border-radius: 10px;
    background: #ef5407;
    color: #0a0a0a;
  }
  button:disabled {
    opacity: 0.4;
  }
  .error {
    color: #ff6a72;
    font-weight: 700;
  }
</style>
