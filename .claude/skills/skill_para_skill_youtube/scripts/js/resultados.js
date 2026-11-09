() => {
  const dur = s => (s || '').split(':').reduce((a, p) => a * 60 + (+p || 0), 0);
  const vistos = new Set();
  const out = [];
  for (const r of document.querySelectorAll('ytd-video-renderer')) {
    if (r.closest('ytd-reel-shelf-renderer, ytd-ad-slot-renderer, ytd-promoted-sparkles-web-renderer')) continue;
    const a = r.querySelector('a#video-title');
    if (!a || !a.href.includes('/watch')) continue;
    const id = new URL(a.href).searchParams.get('v');
    if (vistos.has(id)) continue;
    vistos.add(id);
    const meta = [...r.querySelectorAll('#metadata-line span')].map(s => s.textContent.trim());
    const tempo = r.querySelector('ytd-thumbnail-overlay-time-status-renderer, badge-shape');
    out.push({
      n: out.length + 1,
      id,
      titulo: (a.getAttribute('title') || a.textContent).trim(),
      canal: (r.querySelector('ytd-channel-name #text, #channel-name a')?.textContent || '').trim(),
      duracao_s: dur((tempo?.textContent || '').match(/\d+(:\d+)+/)?.[0]),
      views: meta[0] || '',
      publicado: meta[1] || '',
      trecho: (r.querySelector('.metadata-snippet-text, #description-text')?.textContent || '').trim().slice(0, 160),
      selos: (r.querySelector('#badges')?.textContent || '').replace(/\s+/g, ' ').trim()
    });
  }
  return out;
}
