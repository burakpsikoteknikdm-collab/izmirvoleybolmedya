// Kurumsal sayfalar: /hakkimizda vb. (vercel.json ile buraya yönlenir).
// İçerik content/sayfalar/<ad>.md dosyasından okunur; /admin panelinden düzenlenebilir.
const { SITE, REPO, kacis, ayristir, duzMetin, markdown } = require('./_haber');

// Yayındaki kurumsal sayfalar (dosya adı → menüde görünen ad)
const SAYFALAR = { hakkimizda: 'Hakkımızda' };
const SOSYAL = [
  ['YouTube', 'https://www.youtube.com/@izmirvoleybolmedya'],
  ['Instagram', 'https://www.instagram.com/izmirvoleybolmedya'],
  ['Facebook', 'https://www.facebook.com/share/g/19xt84G5E8/']
];

module.exports = async (req, res) => {
  const ad = new URL(req.url, 'http://x').searchParams.get('ad') || '';
  const yok = () => { res.statusCode = 302; res.setHeader('Location', '/'); res.end(); };
  if (!SAYFALAR[ad]) return yok();
  let s = null;
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/content/sayfalar/${ad}.md`);
    if (r.ok) s = ayristir(await r.text());
  } catch (e) {}
  if (!s) return yok();

  const baslik = s.title;
  const aciklama = s.description || duzMetin(s.body).slice(0, 160);
  const adres = `${SITE}/${ad}`;
  const yapisalVeri = {
    '@context': 'https://schema.org', '@type': ad === 'hakkimizda' ? 'AboutPage' : 'WebPage',
    name: baslik, description: aciklama, url: adres, inLanguage: 'tr-TR',
    publisher: { '@type': 'NewsMediaOrganization', name: 'İzmir Voleybol Medya', url: SITE, logo: { '@type': 'ImageObject', url: SITE + '/editor/ikon-512.png' }, sameAs: SOSYAL.map(x => x[1]).filter(u => !u.includes('/share/')) }
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
<meta name="description" content="${kacis(aciklama)}">
<link rel="canonical" href="${kacis(adres)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="İzmir Voleybol Medya">
<meta property="og:locale" content="tr_TR">
<meta property="og:title" content="${kacis(baslik)} | İzmir Voleybol Medya">
<meta property="og:description" content="${kacis(aciklama)}">
<meta property="og:image" content="${SITE}/editor/ikon-512.png">
<meta property="og:url" content="${kacis(adres)}">
<meta name="theme-color" content="#0b1f4d">
<link rel="icon" href="/editor/ikon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(yapisalVeri).replace(/</g, '\\u003c')}</script>
<style>
:root{--ink:#0b1f4d;--blue:#1e4fd8;--sky:#eaf1ff;--gold:#ffc21a;--muted:#5b6b8c;--line:#d6e0f5;--r:14px}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Barlow',system-ui,sans-serif;background:#f6f9ff;color:var(--ink);line-height:1.75}
a{color:inherit;text-decoration:none}
h1,h2,h3,.marka b,.ust nav a{font-family:'Barlow Condensed',sans-serif}
.wrap{max-width:900px;margin:0 auto;padding:0 20px}
:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.ust{background:var(--ink);color:#fff;box-shadow:0 4px 18px rgba(11,31,77,.3)}
.ust::before{content:"";display:block;height:5px;background:linear-gradient(90deg,var(--blue) 0 34%,var(--gold) 34% 67%,#fff 67%)}
.ust .wrap{max-width:1100px;display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:70px;flex-wrap:wrap}
.marka{display:flex;align-items:center;gap:10px}
.marka img{width:48px;height:48px}
.marka b{font-size:1.5rem;font-weight:800;line-height:1}.marka b i{font-style:normal;color:var(--gold)}
.ust nav{display:flex;gap:20px;flex-wrap:wrap}
.ust nav a{font-size:1.1rem;font-weight:700;padding:8px 0;border-bottom:3px solid transparent}
.ust nav a:hover{border-color:var(--gold)}
.kapak{background:linear-gradient(120deg,var(--ink),#123a9c);color:#fff;padding:46px 0 40px}
.kapak h1{font-size:clamp(2.2rem,5vw,3.3rem);line-height:1.05}
.kapak p{color:#c9d8ff;max-width:46em;margin-top:10px;font-size:1.08rem}
.yerim{font-size:.88rem;color:#9db8ff;margin-bottom:10px}.yerim a{color:#fff;font-weight:600}
article{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:34px;margin:-22px auto 40px;position:relative;font-size:1.07rem}
article h3{font-size:1.7rem;margin:30px 0 10px;line-height:1.15;display:flex;align-items:center;gap:10px}
article h3::before{content:"";width:10px;height:26px;border-radius:5px;background:linear-gradient(var(--blue) 0 50%,var(--gold) 50%);flex:none}
article h3:first-child{margin-top:0}
article h4{font-size:1.3rem;margin:20px 0 6px}
article p,article ul,article ol,article blockquote{margin:0 0 14px}
article ul,article ol{padding-left:24px}
article li{margin-bottom:6px}
article a{color:var(--blue);text-decoration:underline}
article blockquote{border-left:4px solid var(--gold);background:#fffbea;padding:12px 16px;border-radius:0 10px 10px 0;font-size:1.12rem}
article strong{color:var(--ink)}
.takip{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:26px;padding-top:20px;border-top:1px solid var(--line)}
.takip b{font-family:'Barlow Condensed',sans-serif;font-size:1.25rem;margin-right:4px}
.takip a{border-radius:999px;padding:8px 16px;font-weight:700;color:#fff;text-decoration:none}
.takip a.yt{background:#e62117}.takip a.ig{background:linear-gradient(45deg,#f58529,#dd2a7b,#8134af)}.takip a.fb{background:#1877f2}
footer{background:var(--ink);color:#9db8ff;padding:26px 0;text-align:center;font-size:.9rem}
footer b{color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:1.4rem;display:block}
footer .sosyal{display:flex;justify-content:center;gap:18px;margin-top:10px}
footer .sosyal a{color:#fff;font-weight:600;padding:6px 2px}
@media(max-width:600px){article{padding:20px}.ust nav{gap:14px}.ust nav a{font-size:1rem}.marka b{font-size:1.25rem}.marka img{width:40px;height:40px}}
</style>
</head>
<body>
<header class="ust">
  <div class="wrap">
    <a class="marka" href="/"><img src="/images/logo-256.webp" alt="İzmir Voleybol Medya logosu" width="48" height="48"><b>İZMİR VOLEYBOL <i>MEDYA</i></b></a>
    <nav aria-label="Ana menü">
      <a href="/#haberler">Haberler</a>
      <a href="/#bolum/takimlar">İzmir Takımlarımız</a>
      <a href="/#bolum/altyapi">Altyapı</a>
      <a href="/#program">Maç Programı</a>
    </nav>
  </div>
</header>
<section class="kapak">
  <div class="wrap">
    <nav class="yerim" aria-label="Konum"><a href="/">Ana Sayfa</a> › ${kacis(baslik)}</nav>
    <h1>${kacis(baslik)}</h1>
    ${s.description ? `<p>${kacis(s.description)}</p>` : ''}
  </div>
</section>
<main class="wrap">
  <article>
    ${markdown(s.body)}
    <div class="takip">
      <b>Bizi sosyal medyadan takip edin</b>
      <a class="yt" href="${SOSYAL[0][1]}" target="_blank" rel="noopener">YouTube</a>
      <a class="ig" href="${SOSYAL[1][1]}" target="_blank" rel="noopener">Instagram</a>
      <a class="fb" href="${SOSYAL[2][1]}" target="_blank" rel="noopener">Facebook</a>
    </div>
  </article>
</main>
<footer><b>İZMİR VOLEYBOL MEDYA</b>İzmir voleybol haberleri, maç sonuçları ve canlı yayınlar · <a href="mailto:izmirvoleybolmg@gmail.com">izmirvoleybolmg@gmail.com</a>
  <div class="sosyal">${SOSYAL.map(([a, u]) => `<a href="${u}" target="_blank" rel="noopener">${a}</a>`).join('')}</div>
</footer>
</body>
</html>`);
};
