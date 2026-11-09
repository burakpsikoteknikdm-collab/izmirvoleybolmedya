// Haber dosyalarını (content/haberler/*.md) sunucu tarafında okumak için ortak yardımcılar.
// Haber sayfaları (/haber/<ad>) ve site haritası (/sitemap.xml) bunları kullanır.
const SITE = 'https://www.izmirvoleybolmedya.com';
const REPO = 'burakpsikoteknikdm-collab/izmirvoleybolmedya';
const KLASOR = 'content/haberler';
const LIG_ADI = {
  'sultanlar-ligi': 'Sultanlar Ligi', 'efeler-ligi': 'Efeler Ligi',
  'kadinlar-1-ligi': 'Kadınlar 1. Ligi', 'erkekler-1-ligi': 'Erkekler 1. Ligi',
  'kadinlar-2-ligi': 'Kadınlar 2. Ligi', 'erkekler-2-ligi': 'Erkekler 2. Ligi'
};

// Haber fotoğrafları Supabase Storage'daki "gorseller" deposunda durur (her yayında 40 MB taşınmasın diye).
// Eski haberlerdeki /images/uploads/<ad> yolları otomatik olarak bu depoya çevrilir.
const GORSEL_DEPO = 'https://syugifngkyxwkfgklcrd.supabase.co/storage/v1/object/public/gorseller/';
const ESKI_GORSEL = /^\/?images\/uploads\//;
const ESKILER_DEPODA = true; // eski fotoğraflar depoya taşınınca true yapılır
const gorselUrl = u => ESKILER_DEPODA && typeof u === 'string' && ESKI_GORSEL.test(u) ? GORSEL_DEPO + u.replace(ESKI_GORSEL, '') : u;

const kacis = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function onBilgiAyristir(yaml) {
  const f = {};
  let liste = null;
  const temiz = v => v.trim().replace(/^["']|["']$/g, '');
  for (const satir of yaml.split('\n')) {
    const m = satir.match(/^\s*-\s+(.*)$/);
    if (m && liste) { f[liste].push(temiz(m[1])); continue; }
    const i = satir.indexOf(':');
    if (i > 0 && !/^\s/.test(satir)) {
      const k = satir.slice(0, i).trim(), v = satir.slice(i + 1).trim();
      if (v === '' || v === '[]') { f[k] = []; liste = k; }
      else if (/^\[.*\]$/.test(v)) { f[k] = v.slice(1, -1).split(',').map(temiz).filter(Boolean); liste = null; }
      else { f[k] = temiz(v); liste = null; }
    }
  }
  return f;
}
function ayristir(t) {
  const m = String(t).replace(/\r\n/g, '\n').match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return null;
  const f = onBilgiAyristir(m[1]);
  f.body = m[2].trim();
  if (ESKILER_DEPODA) f.body = f.body.replace(/\]\(\/?images\/uploads\//g, '](' + GORSEL_DEPO);
  if (f.image) f.image = gorselUrl(f.image);
  if (Array.isArray(f.galeri)) f.galeri = f.galeri.map(gorselUrl);
  return typeof f.title === 'string' && f.title ? f : null;
}
// Haberin fotoğrafları: kapak + galeri (en fazla 4)
const fotolar = h => [h.image, ...(Array.isArray(h.galeri) ? h.galeri : [])].filter(u => typeof u === 'string' && u).slice(0, 4);

const duzMetin = b => String(b).replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_>`~]/g, '').replace(/(^|\s)#{1,6}\s/g, '$1').replace(/\s+/g, ' ').trim();
const mutlakAdres = u => !u ? '' : /^https?:/.test(u) ? u : SITE + (u.startsWith('/') ? '' : '/') + u;
const guvenliUrl = u => /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(u) ? u : '';

// Basit ve güvenli Markdown → HTML (önce tüm HTML kaçırılır)
function satirIci(s) {
  return s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, u) => guvenliUrl(u) ? `<img src="${u}" alt="${alt}" loading="lazy">` : m)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => guvenliUrl(u) ? `<a href="${u}"${/^https?:/i.test(u) && !u.startsWith(SITE) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>` : m)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])__([^_]+)__(?=[\s).,!?:;]|$)/g, '$1<strong>$2</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}
function markdown(md) {
  return kacis(String(md).replace(/\r\n/g, '\n')).split(/\n{2,}/).map(blok => {
    const satirlar = blok.split('\n');
    const b = satirlar[0].match(/^(#{1,6})\s+(.+)$/);
    if (b && satirlar.length === 1) { const d = Math.min(6, b[1].length + 1); return `<h${d}>${satirIci(b[2])}</h${d}>`; }
    if (satirlar.every(l => /^\s*[-*]\s+/.test(l))) return '<ul>' + satirlar.map(l => `<li>${satirIci(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('') + '</ul>';
    if (satirlar.every(l => /^\s*\d+[.)]\s+/.test(l))) return '<ol>' + satirlar.map(l => `<li>${satirIci(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('') + '</ol>';
    if (satirlar.every(l => /^&gt;\s?/.test(l))) return '<blockquote>' + satirlar.map(l => satirIci(l.replace(/^&gt;\s?/, ''))).join('<br>') + '</blockquote>';
    return '<p>' + satirlar.map(satirIci).join('<br>') + '</p>';
  }).join('\n');
}

// GitHub API (token varsa saatlik sınır çok daha yüksek)
async function gh(yol) {
  const h = { Accept: 'application/vnd.github+json', 'User-Agent': 'izmirvoleybolmedya-seo' };
  if (process.env.GITHUB_ICERIK_TOKEN) h.Authorization = 'Bearer ' + process.env.GITHUB_ICERIK_TOKEN;
  const r = await fetch(`https://api.github.com/repos/${REPO}${yol}`, { headers: h });
  if (!r.ok) throw new Error('GitHub ' + r.status);
  return r.json();
}

async function haberGetir(ad) {
  const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/${KLASOR}/${encodeURIComponent(ad)}.md`);
  if (!r.ok) return null;
  const h = ayristir(await r.text());
  if (h) h.ad = ad;
  return h;
}

// Haber dosyalarının tamamı tek GraphQL çağrısıyla okunur (haber başına ayrı çağrı GitHub'ın saatlik sınırını doldurur).
// Olmazsa: dosya listesi için 1 API çağrısı + içerikler raw.githubusercontent üzerinden (API sınırına sayılmaz).
async function haberDosyalari(dal = 'main') {
  const token = process.env.GITHUB_ICERIK_TOKEN;
  if (token) {
    try {
      const [sahip, ad] = REPO.split('/');
      const r = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'User-Agent': 'izmirvoleybolmedya-seo' },
        body: JSON.stringify({
          query: 'query($sahip:String!,$ad:String!,$yol:String!){repository(owner:$sahip,name:$ad){object(expression:$yol){...on Tree{entries{name type oid object{...on Blob{text}}}}}}}',
          variables: { sahip, ad, yol: `${dal}:${KLASOR}` }
        })
      });
      const j = await r.json();
      if (!r.ok || j.errors) throw new Error('GraphQL ' + r.status);
      return ((j.data.repository.object || {}).entries || [])
        .filter(e => e.type === 'blob' && /.md$/i.test(e.name) && typeof (e.object || {}).text === 'string')
        .map(e => ({ ad: e.name, sha: e.oid, metin: e.object.text }));
    } catch (e) { console.error('GraphQL okunamadı, yedek yöntem:', e.message); }
  }
  const dosyalar = (await gh(`/contents/${KLASOR}?ref=${dal}`)).filter(d => d.type === 'file' && /.md$/i.test(d.name));
  const liste = await Promise.all(dosyalar.map(async d => {
    try {
      const r = await fetch(d.download_url);
      return r.ok ? { ad: d.name, sha: d.sha, metin: await r.text() } : null;
    } catch (e) { return null; }
  }));
  return liste.filter(Boolean);
}

// Tüm haberler (yeniden eskiye)
async function haberListesi() {
  const liste = (await haberDosyalari()).map(d => {
    const h = ayristir(d.metin);
    return h && { ...h, ad: d.ad.replace(/.md$/i, '') };
  });
  return liste.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Sitenin önbellekli haber paketi (/veri/haberler.json); GitHub'a tekrar tekrar gitmemek için
async function onbellekliListe() {
  const r = await fetch(SITE + '/veri/haberler.json');
  if (!r.ok) throw new Error('liste ' + r.status);
  return (await r.json()).haberler;
}

const haberAdresi = ad => `${SITE}/haber/${encodeURIComponent(ad)}`;

module.exports = { haberDosyalari, SITE, REPO, LIG_ADI, GORSEL_DEPO, gorselUrl, kacis, ayristir, fotolar, onbellekliListe, duzMetin, mutlakAdres, markdown, haberGetir, haberListesi, haberAdresi };
