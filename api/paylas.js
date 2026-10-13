// Paylaşılan haber linki: /haber/<ad> (vercel.json ile buraya yönlenir).
// WhatsApp, Facebook, X gibi uygulamalar önizleme için bu sayfadaki og: etiketlerini okur;
// ziyaretçi ise hemen sitedeki habere (/#haber/<ad>) yönlendirilir.
const SITE = 'https://www.izmirvoleybolmedya.com';
const REPO = 'burakpsikoteknikdm-collab/izmirvoleybolmedya';
const VARSAYILAN_GORSEL = SITE + '/editor/ikon-512.png';

const kacis = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function ayristir(t) {
  const m = t.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return null;
  const f = {};
  m[1].split('\n').forEach(l => { const i = l.indexOf(':'); if (i > 0) f[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, ''); });
  f.body = m[2].trim();
  return f.title ? f : null;
}
const duzMetin = b => b.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*_>`~]/g, '').replace(/\s+/g, ' ').trim();

module.exports = async (req, res) => {
  let ad = new URL(req.url, 'http://x').searchParams.get('ad') || '';
  try { ad = decodeURIComponent(ad); } catch (e) {}
  ad = ad.replace(/\.md$/i, '');
  const hedef = '/#haber/' + encodeURIComponent(ad);
  const yonlendir = () => { res.statusCode = 302; res.setHeader('Location', '/'); res.end(); };
  if (!ad || /[\/\\]|\.\./.test(ad)) return yonlendir();

  let h = null;
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/content/haberler/${encodeURIComponent(ad)}.md`);
    if (r.ok) h = ayristir(await r.text());
  } catch (e) {}
  if (!h) return yonlendir();

  const baslik = h.title;
  const ozet = duzMetin(h.body).slice(0, 180) || 'İzmir Voleybol Medya';
  const gorsel = !h.image ? VARSAYILAN_GORSEL : /^https?:/.test(h.image) ? h.image : SITE + (h.image.startsWith('/') ? '' : '/') + h.image;
  const adres = SITE + '/haber/' + encodeURIComponent(ad);

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
<link rel="canonical" href="${kacis(adres)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="İzmir Voleybol Medya">
<meta property="og:locale" content="tr_TR">
<meta property="og:title" content="${kacis(baslik)}">
<meta property="og:description" content="${kacis(ozet)}">
<meta property="og:image" content="${kacis(gorsel)}">
<meta property="og:url" content="${kacis(adres)}">
${h.date ? `<meta property="article:published_time" content="${kacis(h.date)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${kacis(baslik)}">
<meta name="twitter:description" content="${kacis(ozet)}">
<meta name="twitter:image" content="${kacis(gorsel)}">
<meta http-equiv="refresh" content="0;url=${kacis(hedef)}">
<script>location.replace(${JSON.stringify(hedef)});</script>
</head>
<body style="font-family:system-ui,sans-serif;padding:24px">
<p><a href="${kacis(hedef)}">${kacis(baslik)}</a> haberine yönlendiriliyorsunuz…</p>
</body>
</html>`);
};
