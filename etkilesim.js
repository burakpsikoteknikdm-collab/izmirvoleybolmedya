// Haberlerin altındaki beğeni ve yorumlar + bildirim aboneliği (ana sayfa ve haber sayfaları ortak)
(function () {
  var API = '/api/etkilesim';
  var kacis = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // Bu cihaza özel anonim kimlik (beğeninin bir kez sayılması için)
  function cihaz() {
    var k = null;
    try { k = localStorage.getItem('ivm_cihaz'); } catch (e) {}
    if (!k) {
      var b = new Uint8Array(18); crypto.getRandomValues(b);
      k = btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      try { localStorage.setItem('ivm_cihaz', k); } catch (e) {}
    }
    return k;
  }
  function istek(islem, govde, sorgu) {
    return fetch(API + '?islem=' + islem + (sorgu || ''), govde ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) } : undefined)
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || j.hata) throw new Error(j.hata || 'Bir hata oluştu.'); return j; }); });
  }
  var tarih = function (d) { var x = new Date(d); return isNaN(x) ? '' : x.toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

  var STIL = '.etk{margin-top:18px;padding-top:16px;border-top:1px solid #d6e0f5}' +
    '.etk-ust{display:flex;align-items:center;gap:10px;flex-wrap:wrap}' +
    '.etk-b{display:inline-flex;align-items:center;gap:7px;border:2px solid #d6e0f5;background:#fff;color:#0b1f4d;border-radius:999px;padding:7px 16px;font:700 .95rem Barlow,system-ui,sans-serif;cursor:pointer}' +
    '.etk-b:hover{border-color:#1e4fd8}.etk-b.aktif{background:#ffe4e6;border-color:#f43f5e;color:#be123c}.etk-b:disabled{opacity:.6;cursor:default}' +
    '.etk h4{font:800 1.3rem "Barlow Condensed",sans-serif;margin:18px 0 10px;color:#0b1f4d}' +
    '.etk-y{background:#f6f9ff;border:1px solid #d6e0f5;border-radius:12px;padding:10px 14px;margin-bottom:8px}' +
    '.etk-y b{color:#0b1f4d}.etk-y small{color:#5b6b8c;margin-left:6px;font-size:.8rem}.etk-y p{margin:4px 0 0;white-space:pre-wrap;word-break:break-word}' +
    '.etk-f{display:grid;gap:8px;margin-top:10px}' +
    '.etk-f input[type=text],.etk-f textarea{width:100%;border:2px solid #d6e0f5;border-radius:10px;padding:10px 12px;font:1rem Barlow,system-ui,sans-serif;color:#0b1f4d;background:#fff;box-sizing:border-box}' +
    '.etk-f textarea{min-height:90px;resize:vertical}.etk-f input:focus,.etk-f textarea:focus{outline:0;border-color:#1e4fd8}' +
    '.etk-f label.onay{display:flex;gap:8px;align-items:flex-start;font-size:.85rem;color:#5b6b8c}.etk-f label.onay a{color:#1e4fd8}' +
    '.etk-f .tuzak{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
    '.etk-f button{justify-self:start;border:0;border-radius:999px;padding:10px 20px;background:#ffc21a;color:#0b1f4d;font:800 1rem "Barlow Condensed",sans-serif;cursor:pointer}' +
    '.etk-m{font-size:.9rem;font-weight:600}.etk-m.iyi{color:#12805c}.etk-m.kotu{color:#d92d20}.etk-bos{color:#5b6b8c;font-size:.92rem}';
  function stilEkle() { if (document.getElementById('etkStil')) return; var s = document.createElement('style'); s.id = 'etkStil'; s.textContent = STIL; document.head.appendChild(s); }

  // Bir haberin altına beğeni + yorum alanını kurar
  window.IVM_etkilesim = function (kutu, ad) {
    if (!kutu || !ad) return;
    stilEkle();
    kutu.className = 'etk';
    kutu.innerHTML =
      '<div class="etk-ust"><button type="button" class="etk-b begen" disabled>❤️ <span>Beğen</span></button>' +
      '<button type="button" class="etk-b yorumGit">💬 <span>Yorumlar</span></button></div>' +
      '<h4>Yorumlar</h4><div class="etk-liste"><div class="etk-bos">Yükleniyor…</div></div>' +
      '<form class="etk-f" novalidate>' +
      '<input type="text" name="isim" maxlength="40" placeholder="Adınız" autocomplete="name" required>' +
      '<textarea name="metin" maxlength="1000" placeholder="Yorumunuzu yazın…" required></textarea>' +
      '<div class="tuzak" aria-hidden="true"><input type="text" name="web" tabindex="-1" autocomplete="off"></div>' +
      '<label class="onay"><input type="checkbox" name="onay"> <span><a href="/kullanim-kosullari" target="_blank">Yorum kurallarını</a> ve <a href="/kvkk" target="_blank">KVKK Aydınlatma Metni</a>\'ni okudum.</span></label>' +
      '<button type="submit">Yorum Gönder</button><div class="etk-m" role="status"></div></form>';
    var begen = kutu.querySelector('.begen'), liste = kutu.querySelector('.etk-liste'), form = kutu.querySelector('form'), mesaj = kutu.querySelector('.etk-m');
    kutu.querySelector('.yorumGit').onclick = function () { form.scrollIntoView({ behavior: 'smooth', block: 'center' }); form.isim.focus(); };

    function begeniCiz(j) {
      begen.disabled = false;
      begen.classList.toggle('aktif', !!j.begendim);
      begen.querySelector('span').textContent = (j.begendim ? 'Beğendin' : 'Beğen') + (j.begeni ? ' · ' + j.begeni : '');
      begen.setAttribute('aria-pressed', j.begendim ? 'true' : 'false');
    }
    function yorumCiz(yorumlar) {
      kutu.querySelector('.yorumGit span').textContent = 'Yorumlar' + (yorumlar.length ? ' · ' + yorumlar.length : '');
      liste.innerHTML = yorumlar.length ? yorumlar.map(function (y) {
        return '<div class="etk-y"><b>' + kacis(y.ad) + '</b><small>' + kacis(tarih(y.olusturma)) + '</small><p>' + kacis(y.metin) + '</p></div>';
      }).join('') : '<div class="etk-bos">Henüz yorum yok. İlk yorumu siz yapın.</div>';
    }
    istek('haber', null, '&ad=' + encodeURIComponent(ad) + '&cihaz=' + encodeURIComponent(cihaz()))
      .then(function (j) { begeniCiz(j); yorumCiz(j.yorumlar); })
      .catch(function () { kutu.querySelector('.etk-ust').hidden = true; liste.innerHTML = '<div class="etk-bos">Yorumlar şu an yüklenemedi.</div>'; });

    begen.onclick = function () {
      begen.disabled = true;
      istek('begen', { ad: ad, cihaz: cihaz() }).then(begeniCiz).catch(function () { begen.disabled = false; });
    };
    form.onsubmit = function (e) {
      e.preventDefault();
      mesaj.className = 'etk-m'; mesaj.textContent = '';
      var btn = form.querySelector('button'); btn.disabled = true;
      istek('yorum', { ad: ad, isim: form.isim.value, metin: form.metin.value, onay: form.onay.checked, web: form.web.value })
        .then(function () {
          form.metin.value = '';
          mesaj.className = 'etk-m iyi';
          mesaj.textContent = 'Teşekkürler! Yorumunuz editör onayından sonra yayınlanacak.';
        })
        .catch(function (err) { mesaj.className = 'etk-m kotu'; mesaj.textContent = err.message; })
        .then(function () { btn.disabled = false; });
    };
  };

  /* ---------- Bildirim aboneliği ---------- */
  var destek = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  function b64(s) { var p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, function (c) { return c.charCodeAt(0); }); }
  function kayit() { return navigator.serviceWorker.register('/bildirim-sw.js', { scope: '/' }); }
  function durum() {
    if (!destek) return Promise.resolve('desteksiz');
    if (Notification.permission === 'denied') return Promise.resolve('engelli');
    return navigator.serviceWorker.getRegistration('/').then(function (r) { return r ? r.pushManager.getSubscription() : null; }).then(function (a) { return a ? 'abone' : 'degil'; });
  }
  function abone() {
    return Notification.requestPermission().then(function (izin) {
      if (izin !== 'granted') throw new Error('Bildirim izni verilmedi.');
      return Promise.all([kayit().then(function () { return navigator.serviceWorker.ready; }), istek('vapid')]);
    }).then(function (s) {
      return s[0].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(s[1].anahtar) });
    }).then(function (a) { return istek('abone', { abonelik: a.toJSON() }); });
  }
  function iptal() {
    return navigator.serviceWorker.getRegistration('/').then(function (r) { return r && r.pushManager.getSubscription(); }).then(function (a) {
      if (!a) return;
      var ep = a.endpoint;
      return a.unsubscribe().then(function () { return istek('abonelik-iptal', { endpoint: ep }); });
    });
  }
  // [data-bildirim] işaretli düğmeler bildirim aç/kapa düğmesine dönüşür
  window.IVM_bildirimDugmeleri = function () {
    var dugmeler = [].slice.call(document.querySelectorAll('[data-bildirim]'));
    if (!dugmeler.length) return;
    function ciz(d) {
      dugmeler.forEach(function (b) {
        b.hidden = d === 'desteksiz';
        b.textContent = d === 'abone' ? '🔕 Bildirimleri Kapat' : '🔔 Bildirimleri Aç';
        b.title = d === 'engelli' ? 'Bildirimler tarayıcı ayarlarından engellenmiş' : '';
        b.dataset.durum = d;
      });
    }
    durum().then(ciz);
    dugmeler.forEach(function (b) {
      b.onclick = function (e) {
        e.preventDefault();
        if (b.dataset.durum === 'engelli') { alert('Bildirimler bu tarayıcıda engellenmiş. Adres çubuğundaki kilit simgesinden bildirim iznini açabilirsiniz.'); return; }
        var is = b.dataset.durum === 'abone' ? iptal() : abone();
        dugmeler.forEach(function (x) { x.disabled = true; });
        is.then(function () { return durum(); }).then(function (d) {
          ciz(d);
          if (d === 'abone') alert('Bildirimler açıldı. Yeni haberler yayınlandığında haberiniz olacak.');
        }).catch(function (err) { alert(err.message || 'Bildirimler açılamadı.'); return durum().then(ciz); })
          .then(function () { dugmeler.forEach(function (x) { x.disabled = false; }); });
      };
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.IVM_bildirimDugmeleri);
  else window.IVM_bildirimDugmeleri();
})();
