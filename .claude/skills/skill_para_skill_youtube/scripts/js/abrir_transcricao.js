async () => {
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const painel = () => document.querySelector(
    'ytd-engagement-panel-section-list-renderer[target-id*="transcript"][visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]');
  if (painel()) return { ok: true, ja_aberto: true };
  document.querySelector('#description-inline-expander #expand, tp-yt-paper-button#expand')?.click();
  await espera(700 + Math.random() * 600);
  const botao = [...document.querySelectorAll('button, yt-button-shape button, ytd-button-renderer')]
    .find(e => /transcri/i.test(e.getAttribute('aria-label') || e.textContent || ''));
  if (!botao) return { ok: false, motivo: 'botão de transcrição não encontrado' };
  botao.scrollIntoView({ block: 'center' });
  await espera(400 + Math.random() * 500);
  botao.click();
  for (let i = 0; i < 20 && !painel(); i++) await espera(300);
  return { ok: !!painel() };
}
