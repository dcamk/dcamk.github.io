() => {
  const seg = s => (s || '').trim().split(':').reduce((a, p) => a * 60 + (+p || 0), 0);
  const itens = [...document.querySelectorAll('ytd-transcript-segment-renderer, transcript-segment-view-model')];
  let out = itens.map(s => ({
    t: seg(s.querySelector('.segment-timestamp, [class*="imestamp"]')?.textContent),
    txt: (s.querySelector('.segment-text, yt-formatted-string.segment-text, [class*="egmentText"], span[role="text"]')?.textContent || '')
      .replace(/\s+/g, ' ').trim()
  })).filter(s => s.txt);
  if (out.length) return out;
  const painel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id*="transcript"]');
  const linhas = (painel?.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
  out = [];
  for (let i = 0; i < linhas.length - 1; i++) {
    if (/^\d+(:\d+)+$/.test(linhas[i])) { out.push({ t: seg(linhas[i]), txt: linhas[i + 1] }); i++; }
  }
  return out;
}
