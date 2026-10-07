// Novidades do Lumo: mostra a versão mais recente publicada no GitHub (dcamk/lumo).
// Mostra só "Nova versão" e o número (última Release; se não houver, a última tag).
// O resultado fica em cache por 1 h para não estourar o limite da API pública.
(function () {
  var REPO = 'dcamk/lumo';
  var API = 'https://api.github.com/repos/' + REPO;
  var KEY = 'lumo.novidades.v2';
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
        return { v: r.tag_name, url: r.html_url };
      })
      .catch(function () {
        return getJSON(API + '/tags?per_page=1').then(function (tags) {
          if (!tags.length) throw new Error('sem tags');
          return { v: tags[0].name, url: 'https://github.com/' + REPO + '/releases/tag/' + tags[0].name };
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
    el.innerHTML =
      '<a href="' + esc(info.url) + '" rel="noopener" target="_blank">' +
      '<span class="lumo-news-dot" aria-hidden="true"></span>' +
      '<span class="lumo-news-t">Nova versão</span>' +
      '<span class="lumo-news-tag">' + esc(info.v) + '</span>' +
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
