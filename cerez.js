// Çerez onayı: kişiselleştirilmiş Google reklamları yalnızca "Kabul Et" seçildiğinde.
// AdSense betiğinden ÖNCE yüklenmelidir.
(function () {
  var ANAHTAR = 'ivm_cerez';
  var tercih = null;
  try { tercih = localStorage.getItem(ANAHTAR); } catch (e) {}
  window.adsbygoogle = window.adsbygoogle || [];
  if (tercih !== 'kabul') window.adsbygoogle.requestNonPersonalizedAds = 1;

  function kaydet(deger) {
    try { localStorage.setItem(ANAHTAR, deger); } catch (e) {}
    var b = document.getElementById('cerezBandi');
    if (b) b.remove();
  }

  function bantGoster() {
    if (document.getElementById('cerezBandi')) return;
    var stil = document.createElement('style');
    stil.textContent =
      '#cerezBandi{position:fixed;left:12px;right:12px;bottom:12px;z-index:1000;max-width:880px;margin:0 auto;background:#0b1f4d;color:#e8eefc;' +
      'border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.35);padding:16px 18px;display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;' +
      'font:15px/1.5 Barlow,system-ui,sans-serif}' +
      '#cerezBandi p{flex:1 1 320px;margin:0}#cerezBandi a{color:#ffc21a;text-decoration:underline}' +
      '#cerezBandi .d{display:flex;gap:8px;flex-wrap:wrap}' +
      '#cerezBandi button{border:0;border-radius:999px;padding:10px 18px;font:700 15px Barlow,system-ui,sans-serif;cursor:pointer}' +
      '#cerezBandi .k{background:#ffc21a;color:#0b1f4d}#cerezBandi .r{background:transparent;color:#fff;border:2px solid #3b5bb5}';
    document.head.appendChild(stil);
    var b = document.createElement('div');
    b.id = 'cerezBandi';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Çerez tercihleri');
    b.innerHTML =
      '<p>Sitemizde zorunlu çerezlerin yanı sıra, onay vermeniz hâlinde kişiselleştirilmiş reklam için Google çerezleri kullanılır. ' +
      'Ayrıntılar: <a href="/cerez-politikasi">Çerez Politikası</a> · <a href="/kvkk">KVKK Aydınlatma Metni</a></p>' +
      '<div class="d"><button type="button" class="r">Reddet</button><button type="button" class="k">Kabul Et</button></div>';
    b.querySelector('.k').onclick = function () { kaydet('kabul'); };
    b.querySelector('.r').onclick = function () { kaydet('ret'); };
    document.body.appendChild(b);
  }

  // Alt bilgideki "Çerez Tercihleri" bağlantısı
  window.cerezTercihleri = function () {
    try { localStorage.removeItem(ANAHTAR); } catch (e) {}
    bantGoster();
  };

  if (!tercih) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bantGoster);
    else bantGoster();
  }
})();
