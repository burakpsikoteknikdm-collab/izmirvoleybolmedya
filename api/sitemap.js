// Site haritası: /sitemap.xml (vercel.json ile buraya yönlenir). Yeni haberler kendiliğinden eklenir.
const { SITE, kacis, haberListesi, haberAdresi } = require('./_haber');

module.exports = async (req, res) => {
  let haberler = [];
  try { haberler = await haberListesi(); } catch (e) {}
  const tarih = d => { const x = new Date(d); return isNaN(x) ? '' : x.toISOString(); };
  const son = haberler[0] ? tarih(haberler[0].date) : '';
  const url = (loc, lastmod, oncelik, siklik) =>
    `  <url><loc>${kacis(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>${siklik}</changefreq><priority>${oncelik}</priority></url>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
  res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${url(SITE + '/', son, '1.0', 'hourly')}
${['hakkimizda', 'kunye', 'kvkk', 'cerez-politikasi', 'kullanim-kosullari'].map(a => url(SITE + '/' + a, '', a === 'hakkimizda' ? '0.5' : '0.3', 'monthly')).join('\n')}
${haberler.map(h => url(haberAdresi(h.ad), tarih(h.date), '0.8', 'weekly')).join('\n')}
</urlset>
`);
};
