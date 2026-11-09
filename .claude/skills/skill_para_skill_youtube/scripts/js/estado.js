() => {
  const v = document.querySelector('video');
  const t = (document.body.innerText || '').slice(0, 4000);
  return {
    url: location.href,
    verificacao: /não sou um robô|unusual traffic|tráfego incomum|confirme que você não é um robô|sign in to confirm/i.test(t),
    consentimento: /antes de continuar|before you continue/i.test(t) || location.hostname.startsWith('consent.'),
    anuncio_tocando: !!document.querySelector('.ad-showing'),
    pular_anuncio: !!document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button-modern'),
    video_pausado: v ? v.paused : null
  };
}
