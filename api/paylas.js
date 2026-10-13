// Haber sayfası: /haber/<ad> (vercel.json ile buraya yönlenir).
// Google'ın dizine ekleyebilmesi için haber sunucuda tam sayfa olarak hazırlanır; WhatsApp, Facebook,
// X gibi uygulamalar da önizleme için buradaki og: etiketlerini okur.
const { SITE, LIG_ADI, kacis, duzMetin, mutlakAdres, markdown, haberGetir, haberListesi, haberAdresi, fotolar } = require('./_haber');
const VARSAYILAN_GORSEL = SITE + '/editor/ikon-512.png';
const LOGO = SITE + '/editor/ikon-512.png';

const tarihYaz = d => { const x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }); };
const saatYaz = d => { const x = new Date(d); return isNaN(x) ? '' : x.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }); };
// Yeni yüklenen görsel site yayına alınana kadar GitHub'dan gösterilir
const yedek = yol => String(yol || '').startsWith('/images/') ? ` onerror="this.onerror=null;this.src='https://raw.githubusercontent.com/burakpsikoteknikdm-collab/izmirvoleybolmedya/main${kacis(yol)}'"` : '';
const jsonLd = o => JSON.stringify(o).replace(/</g, '\\u003c');

module.exports = async (req, res) => {
  let ad = new URL(req.url, 'http://x').searchParams.get('ad') || '';
  try { ad = decodeURIComponent(ad); } catch (e) {}
  ad = ad.replace(/\.md$/i, '');
  const anaSayfa = () => { res.statusCode = 302; res.setHeader('Location', '/'); res.end(); };
  if (!ad || /[\/\\]|\.\./.test(ad)) return anaSayfa();

  const h = await haberGetir(ad).catch(() => null);
  if (!h) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.end(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Haber bulunamadı | İzmir Voleybol Medya</title></head><body style="font-family:system-ui,sans-serif;padding:40px;text-align:center"><h1>Haber bulunamadı</h1><p>Aradığınız haber kaldırılmış olabilir.</p><p><a href="/">Ana sayfaya dön</a></p></body></html>`);
  }
  // Diğer haberler: iç bağlantılar (hata olursa sayfa yine açılır)
  const digerleri = await haberListesi().then(l => l.filter(x => x.ad !== ad).slice(0, 6)).catch(() => []);

  const baslik = h.title;
  const ozet = duzMetin(h.body).slice(0, 160) || 'İzmir voleybol haberleri';
  const gorsel = mutlakAdres(h.image) || VARSAYILAN_GORSEL;
  const adres = haberAdresi(ad);
  const lig = LIG_ADI[h.lig] || '';
  const tarih = new Date(h.date);
  const isoTarih = isNaN(tarih) ? '' : tarih.toISOString();
  const foto = fotolar(h);
  const fotoHtml = !foto.length ? '' : foto.length === 1
    ? `<img class="kapak" src="${kacis(mutlakAdres(foto[0]))}" alt="${kacis(baslik)}"${yedek(foto[0])}>`
    : `<div class="galeri" tabindex="0" aria-roledescription="fotoğraf galerisi" aria-label="${foto.length} fotoğraf">
        <div class="g-iz">${foto.map((u, i) => `<img src="${kacis(mutlakAdres(u))}" alt="${kacis(baslik)} – fotoğraf ${i + 1}"${i ? ' loading="lazy"' : ''}${yedek(u)}>`).join('')}</div>
        <button type="button" class="g-ok g-onc" aria-label="Önceki fotoğraf">‹</button>
        <button type="button" class="g-ok g-son" aria-label="Sonraki fotoğraf">›</button>
        <span class="g-sayac">1 / ${foto.length}</span>
        <div class="g-nokta">${foto.map((_, i) => `<span${i ? '' : ' class="aktif"'}></span>`).join('')}</div>
      </div>`;

  const yapisalVeri = [{
    '@context': 'https://schema.org', '@type': 'NewsArticle',
    headline: baslik.slice(0, 110), description: ozet, image: foto.length ? foto.map(mutlakAdres) : [gorsel],
    datePublished: isoTarih || undefined, dateModified: isoTarih || undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': adres },
    articleSection: lig || 'İzmir Voleybol', inLanguage: 'tr-TR',
    author: { '@type': 'Organization', name: 'İzmir Voleybol Medya', url: SITE },
    publisher: { '@type': 'NewsMediaOrganization', name: 'İzmir Voleybol Medya', url: SITE, logo: { '@type': 'ImageObject', url: LOGO } }
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Haberler', item: SITE + '/#haberler' },
      { '@type': 'ListItem', position: 3, name: baslik, item: adres }
    ]
  }];

  const e = encodeURIComponent;
  const paylas = {
    whatsapp: `https://wa.me/?text=${e(baslik + ' ' + adres)}`,
    x: `https://twitter.com/intent/tweet?text=${e(baslik)}&url=${e(adres)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${e(adres)}`,
    telegram: `https://t.me/share/url?url=${e(adres)}&text=${e(baslik)}`
  };

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  res.end(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${kacis(baslik)} | İzmir Voleybol Medya</title>
<meta name="description" content="${kacis(ozet)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${kacis(adres)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="İzmir Voleybol Medya">
<meta property="og:locale" content="tr_TR">
<meta property="og:title" content="${kacis(baslik)}">
<meta property="og:description" content="${kacis(ozet)}">
<meta property="og:image" content="${kacis(gorsel)}">
<meta property="og:url" content="${kacis(adres)}">
${isoTarih ? `<meta property="article:published_time" content="${isoTarih}">` : ''}
${lig ? `<meta property="article:section" content="${kacis(lig)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${kacis(baslik)}">
<meta name="twitter:description" content="${kacis(ozet)}">
<meta name="twitter:image" content="${kacis(gorsel)}">
<meta name="theme-color" content="#0b1f4d">
<link rel="icon" href="/editor/ikon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
<script src="/cerez.js"></script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9798524131017882" crossorigin="anonymous"></script>
<script type="application/ld+json">${jsonLd(yapisalVeri)}</script>
<style>
:root{--ink:#0b1f4d;--blue:#1e4fd8;--sky:#eaf1ff;--gold:#ffc21a;--muted:#5b6b8c;--line:#d6e0f5;--r:14px}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Barlow',system-ui,sans-serif;background:#f6f9ff;color:var(--ink);line-height:1.7}
a{color:inherit;text-decoration:none}
h1,h2,h3,.marka b,.ust nav a{font-family:'Barlow Condensed',sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:0 20px}
:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.ust{background:var(--ink);color:#fff;box-shadow:0 4px 18px rgba(11,31,77,.3)}
.ust::before{content:"";display:block;height:5px;background:linear-gradient(90deg,var(--blue) 0 34%,var(--gold) 34% 67%,#fff 67%)}
.ust .wrap{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:70px;flex-wrap:wrap}
.marka{display:flex;align-items:center;gap:10px}
.marka img{width:48px;height:48px}
.marka b{font-size:1.5rem;font-weight:800;line-height:1}.marka b i{font-style:normal;color:var(--gold)}
.ust nav{display:flex;gap:20px;flex-wrap:wrap}
.ust nav a{font-size:1.1rem;font-weight:700;padding:8px 0;border-bottom:3px solid transparent}
.ust nav a:hover{border-color:var(--gold)}
.yerim{font-size:.88rem;color:var(--muted);margin:22px 0 10px}
.yerim a{color:var(--blue);font-weight:600}
.duzen{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:28px;align-items:start;padding-bottom:40px}
article{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:28px}
.kat{display:inline-block;background:var(--gold);color:var(--ink);font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:.85rem;letter-spacing:.04em;padding:3px 10px;border-radius:4px;text-transform:uppercase}
article h1{font-size:clamp(1.8rem,4vw,2.7rem);line-height:1.08;margin:10px 0 8px;font-weight:800}
.bilgi{color:var(--muted);font-size:.92rem}
.kapak{width:100%;border-radius:10px;margin:18px 0 6px;display:block}
.metin{font-size:1.07rem;margin-top:16px}
.galeri{position:relative;margin:18px 0 6px;border-radius:10px;overflow:hidden;background:#0b1f4d}
.g-iz{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}
.g-iz::-webkit-scrollbar{display:none}
.g-iz img{flex:0 0 100%;width:100%;aspect-ratio:4/3;object-fit:contain;scroll-snap-align:center;display:block}
.g-ok{position:absolute;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:var(--ink);font-size:1.6rem;font-weight:700;line-height:1;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}
.g-onc{left:10px}.g-son{right:10px}.g-ok:disabled{opacity:0;pointer-events:none}
.g-sayac{position:absolute;top:10px;right:10px;background:rgba(6,18,46,.78);color:#fff;font-size:.8rem;font-weight:700;padding:3px 10px;border-radius:999px}
.g-nokta{position:absolute;bottom:10px;left:0;right:0;display:flex;justify-content:center;gap:6px}
.g-nokta span{width:8px;height:8px;border-radius:5px;background:rgba(255,255,255,.55);transition:width .2s}
.g-nokta span.aktif{background:#fff;width:20px}
.metin p,.metin ul,.metin ol,.metin blockquote{margin:0 0 16px}
.metin ul,.metin ol{padding-left:24px}
.metin h2,.metin h3,.metin h4{margin:22px 0 8px;line-height:1.2}
.metin a{color:var(--blue);text-decoration:underline}
.metin img{max-width:100%;border-radius:8px}
.metin blockquote{border-left:4px solid var(--gold);padding-left:14px;color:var(--muted)}
.paylas{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:18px 0 4px;padding-top:16px;border-top:1px solid var(--line)}
.paylas>span{font-size:.88rem;font-weight:700;color:var(--muted)}
.pb{display:inline-flex;align-items:center;border:0;border-radius:999px;padding:8px 15px;font:inherit;font-size:.92rem;font-weight:700;color:#fff;cursor:pointer}
.takip{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:14px;padding:14px 16px;border-radius:12px;background:var(--sky)}
.takip b{font-family:'Barlow Condensed',sans-serif;font-size:1.15rem;margin-right:6px}
.takip a{border-radius:999px;padding:7px 15px;font-weight:700;font-size:.9rem;color:#fff;text-decoration:none}
.takip a.yt{background:#e62117}.takip a.ig{background:linear-gradient(45deg,#f58529,#dd2a7b,#8134af)}.takip a.fb{background:#1877f2}
.pb.yerel{background:var(--ink)}.pb.wa{background:#1fa855}.pb.x{background:#111}.pb.fb{background:#1877f2}.pb.tg{background:#229ed9}.pb.kopya{background:var(--sky);color:var(--ink)}
aside h2{font-size:1.5rem;margin-bottom:12px}
.diger{display:flex;gap:12px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:10px}
.diger:hover{border-color:var(--blue)}
.diger img,.diger .bos{width:96px;height:66px;flex:none;object-fit:cover;border-radius:8px;background:var(--sky)}
.diger b{font-weight:700;line-height:1.25;font-size:.95rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.diger time{display:block;font-size:.78rem;color:var(--blue);font-weight:600;margin-top:3px}
.tum{display:inline-block;margin-top:6px;background:var(--ink);color:#fff;border-radius:999px;padding:10px 20px;font-weight:700}
footer{background:var(--ink);color:#9db8ff;padding:26px 0;text-align:center;font-size:.9rem}
footer b{color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:1.4rem;display:block}
footer .kurumsal{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 16px;margin-top:12px;font-size:.85rem}
footer .kurumsal a{color:#c9d8ff;padding:4px 0}
footer .kurumsal a:hover{color:#fff;text-decoration:underline}
footer .sosyal{display:flex;justify-content:center;gap:18px;margin-top:10px}
footer .sosyal a{color:#fff;font-weight:600;padding:6px 2px}
footer .sosyal a:hover{text-decoration:underline}
@media(max-width:900px){.duzen{grid-template-columns:1fr}}
@media(max-width:600px){article{padding:18px}.ust nav{gap:14px}.ust nav a{font-size:1rem}.marka b{font-size:1.25rem}.marka img{width:40px;height:40px}}
</style>
</head>
<body>
<header class="ust">
  <div class="wrap">
    <a class="marka" href="/"><img src="/images/logo-256.webp" alt="İzmir Voleybol Medya logosu" width="48" height="48"><b>İZMİR VOLEYBOL <i>MEDYA</i></b></a>
    <nav aria-label="Ana menü">
      <a href="/#haberler">Haberler</a>
      <a href="/#lig/sultanlar-ligi">Ligler</a>
      <a href="/#milli/kadin">Milli Takımlar</a>
      <a href="/#program">Maç Programı</a>
      <a href="/hakkimizda">Hakkımızda</a>
    </nav>
  </div>
</header>
<main class="wrap">
  <nav class="yerim" aria-label="Konum"><a href="/">Ana Sayfa</a> › <a href="/#haberler">Haberler</a>${lig ? ` › <a href="/#lig/${kacis(h.lig)}">${kacis(lig)}</a>` : ''}</nav>
  <div class="duzen">
    <article>
      ${lig ? `<a class="kat" href="/#lig/${kacis(h.lig)}">${kacis(lig)}</a>` : '<span class="kat">İzmir Voleybol</span>'}
      <h1>${kacis(baslik)}</h1>
      <div class="bilgi">${isoTarih ? `<time datetime="${isoTarih}">${tarihYaz(h.date)} · ${saatYaz(h.date)}</time> · ` : ''}İzmir Voleybol Medya</div>
      ${fotoHtml}
      <div class="metin">${markdown(h.body)}</div>
      <div class="paylas">
        <span>Paylaş:</span>
        <button type="button" class="pb yerel" id="yerel" hidden>📤 Paylaş</button>
        <a class="pb wa" href="${kacis(paylas.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="pb x" href="${kacis(paylas.x)}" target="_blank" rel="noopener">X</a>
        <a class="pb fb" href="${kacis(paylas.facebook)}" target="_blank" rel="noopener">Facebook</a>
        <a class="pb tg" href="${kacis(paylas.telegram)}" target="_blank" rel="noopener">Telegram</a>
        <button type="button" class="pb kopya" id="kopya">🔗 Linki Kopyala</button>
      </div>
      <div class="takip">
        <b>Bizi sosyal medyadan takip edin</b>
        <a class="yt" href="https://www.youtube.com/@izmirvoleybolmedya" target="_blank" rel="noopener">YouTube</a>
        <a class="ig" href="https://www.instagram.com/izmirvoleybolmedya" target="_blank" rel="noopener">Instagram</a>
        <a class="fb" href="https://www.facebook.com/share/g/19xt84G5E8/" target="_blank" rel="noopener">Facebook</a>
      </div>
    </article>
    <aside>
      <h2>Diğer Haberler</h2>
      ${digerleri.map(d => `<a class="diger" href="/haber/${encodeURIComponent(d.ad)}">
        ${d.image ? `<img src="${kacis(mutlakAdres(d.image))}" alt="${kacis(d.title)}" loading="lazy"${yedek(d.image)}>` : '<span class="bos"></span>'}
        <span><b>${kacis(d.title)}</b><time>${tarihYaz(d.date)}</time></span>
      </a>`).join('')}
      <a class="tum" href="/#haberler">Tüm Haberler →</a>
    </aside>
  </div>
</main>
<footer><b>İZMİR VOLEYBOL MEDYA</b>İzmir voleybol haberleri, maç sonuçları ve canlı yayınlar · <a href="mailto:izmirvoleybolmg@gmail.com">izmirvoleybolmg@gmail.com</a><div class="sosyal"><a href="https://www.youtube.com/@izmirvoleybolmedya" target="_blank" rel="noopener">YouTube</a><a href="https://www.instagram.com/izmirvoleybolmedya" target="_blank" rel="noopener">Instagram</a><a href="https://www.facebook.com/share/g/19xt84G5E8/" target="_blank" rel="noopener">Facebook</a></div><div class="kurumsal"><a href="/hakkimizda">Hakkımızda</a><a href="/kunye">Künye</a><a href="/kvkk">KVKK Aydınlatma Metni</a><a href="/cerez-politikasi">Çerez Politikası</a><a href="/kullanim-kosullari">Kullanım Koşulları</a><a href="#" onclick="cerezTercihleri();return false">Çerez Tercihleri</a></div></footer>
<script>
(function () {
  var url = ${JSON.stringify(adres)}, baslik = ${JSON.stringify(baslik).replace(/</g, '\\u003c')};
  var yerel = document.getElementById('yerel');
  if (navigator.share) { yerel.hidden = false; yerel.onclick = function () { navigator.share({ title: baslik, text: baslik, url: url }).catch(function () {}); }; }
  document.querySelectorAll('.galeri').forEach(function (g) {
    var iz = g.querySelector('.g-iz'), n = iz.children.length, onc = g.querySelector('.g-onc'), son = g.querySelector('.g-son'), t;
    var aktif = function () { return Math.round(iz.scrollLeft / iz.clientWidth); };
    var git = function (i) { iz.scrollTo({ left: Math.max(0, Math.min(n - 1, i)) * iz.clientWidth, behavior: 'smooth' }); setTimeout(guncelle, 450); };
    function guncelle() { var a = aktif(); g.querySelector('.g-sayac').textContent = (a + 1) + ' / ' + n; [].forEach.call(g.querySelectorAll('.g-nokta span'), function (s, i) { s.className = i === a ? 'aktif' : ''; }); onc.disabled = a <= 0; son.disabled = a >= n - 1; }
    iz.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(guncelle, 60); }, { passive: true });
    onc.onclick = function () { git(aktif() - 1); }; son.onclick = function () { git(aktif() + 1); };
    g.onkeydown = function (e) { if (e.key === 'ArrowLeft') git(aktif() - 1); if (e.key === 'ArrowRight') git(aktif() + 1); };
    guncelle();
  });
  var kopya = document.getElementById('kopya');
  kopya.onclick = function () {
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(function () { kopya.textContent = '✓ Kopyalandı'; })
      .catch(function () { prompt('Haber linki:', url); });
  };
})();
</script>
</body>
</html>`);
};
