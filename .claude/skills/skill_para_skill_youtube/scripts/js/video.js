() => {
  const q = s => document.querySelector(s);
  const txt = s => (q(s)?.textContent || '').replace(/\s+/g, ' ').trim();
  const seg = s => (s || '').trim().split(':').reduce((a, p) => a * 60 + (+p || 0), 0);
  const caps = [...document.querySelectorAll('ytd-macro-markers-list-item-renderer')]
    .map(c => ({ t: seg(c.querySelector('#time')?.textContent), titulo: (c.querySelector('h4')?.textContent || '').trim() }))
    .filter((c, i, a) => c.titulo && a.findIndex(x => x.t === c.t) === i);
  const overlay = q('.ytp-paid-content-overlay');
  return {
    id: new URL(location.href).searchParams.get('v'),
    titulo: txt('h1.ytd-watch-metadata') || txt('h1 yt-formatted-string'),
    canal: txt('ytd-watch-metadata ytd-channel-name a') || txt('#owner #channel-name a'),
    inscritos: txt('#owner-sub-count'),
    info: txt('ytd-watch-info-text #info') || txt('#info-container'),
    likes: q('like-button-view-model button, #segmented-like-button button')?.getAttribute('aria-label') || '',
    descricao: (q('#description-inline-expander')?.innerText || q('#description')?.innerText || '').slice(0, 3000),
    capitulos: caps,
    promocao_paga: !!(overlay && overlay.textContent.trim())
  };
}
