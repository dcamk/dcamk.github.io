// Novidades do Lumo: mostra a versão mais recente publicada no GitHub (dcamk/lumo).
// Usa a última Release; se não houver, a última tag + mensagem do commit.
// O resultado fica em cache por 1 h para não estourar o limite da API pública.
(function () {
  var REPO = 'dcamk/lumo';
  var API = 'https://api.github.com/repos/' + REPO;
  var KEY = 'lumo.novidades';
  var TTL = 60 * 60 * 1000;
  var info = null;
  var pending = null;

  function getJSON(url) {
    return fetch(url, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  function load() {
    try {
      var c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (c && Date.now() - c.t < TTL) return Promise.resolve(c.d);
    } catch (e) {}
    return getJSON(API + '/releases/latest')
      .then(function (r) {
        return {
          v: r.tag_name,
          titulo: (r.name || '').replace(/^Lumo\s+v?[\d.]+\s*[:·—-]?\s*/i, ''),
          data: r.published_at,
          url: r.html_url,
        };
      })
      .catch(function () {
        return getJSON(API + '/tags?per_page=1').then(function (tags) {
          if (!tags.length) throw new Error('sem tags');
          return getJSON(API + '/commits/' + tags[0].commit.sha).then(function (c) {
            var linha = (c.commit.message || '').split('\n')[0];
            return {
              v: tags[0].name,
              titulo: linha.replace(/^Lumo\s+v?[\d.]+\s*[:·—-]?\s*/i, ''),
              data: c.commit.committer.date,
              url: 'https://github.com/' + REPO + '/commit/' + tags[0].commit.sha,
            };
          });
        });
      })
      .then(function (d) {
        try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
        return d;
      });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function render(el) {
    if (!info || el.dataset.ok) return;
    var data = '';
    try { data = new Date(info.data).toLocaleDateString('pt-BR'); } catch (e) {}
    el.innerHTML =
      '<a href="' + esc(info.url) + '" rel="noopener" target="_blank">' +
      '<span class="lumo-news-dot" aria-hidden="true"></span>' +
      '<span class="lumo-news-tag">Novo · ' + esc(info.v) + '</span>' +
      '<span class="lumo-news-t">' + esc(info.titulo || 'Nova versão disponível') + '</span>' +
      (data ? '<span class="lumo-news-d">' + esc(data) + '</span>' : '') +
      '</a>';
    el.hidden = false;
    el.dataset.ok = '1';
  }

  function scan() {
    var els = document.querySelectorAll('[data-lumo-news]:not([data-ok])');
    if (!els.length) return;
    if (!info && !pending) {
      pending = load().then(function (d) { info = d; scan(); }).catch(function () {
        setTimeout(function () { pending = null; scan(); }, 30000); // tenta de novo depois
      });
    }
    els.forEach(render);
  }

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
