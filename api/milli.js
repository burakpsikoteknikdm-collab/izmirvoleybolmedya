// TVF milli takım haberleri ve A milli takım kadroları: /api/milli?kat=kadin
const { TVF, metin, gonder } = require('./_tvf');

const KATEGORILER = {
  'kadin': { ad: 'Kadın Milli Takımlar', yol: '/icerikler/kadin-milli-takimlar', tur: 'haber' },
  'erkek': { ad: 'Erkek Milli Takımlar', yol: '/icerikler/erkek-milli-takimlar', tur: 'haber' },
  'a-kadin-kadro': { ad: 'A Milli Kadın Takımı Kadro', yol: '/takim/a-milli-kadin-takimi-kadro', tur: 'kadro' },
  'a-erkek-kadro': { ad: 'A Milli Erkek Takımı Kadro', yol: '/takim/a-milli-erkek-takimi-kadro', tur: 'kadro' },
  'altyapi-kadin': { ad: 'Altyapı Milli Takımlar - Kadın', yol: '/icerikler/altyapi-milli-takimlar-kadin', tur: 'haber' },
  'altyapi-erkek': { ad: 'Altyapı Milli Takımlar - Erkek', yol: '/icerikler/altyapi-milli-takimlar-erkek', tur: 'haber' }
};
const AYLAR = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
const guvenli = u => /^https:\/\/(www\.)?tvf\.org\.tr\//.test(u || '') ? u : '';

// "05 Ekim 2026" → "2026-10-05"
function isoTarih(t) {
  const m = t.match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
  const ay = m ? AYLAR.indexOf(m[2].toLocaleLowerCase('tr-TR')) : -1;
  return ay < 0 ? '' : `${m[3]}-${String(ay + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function haberler(html) {
  return html.split(/<div class="col-12 col-md-6 col-lg-4 item">/).slice(1).map(p => {
    const link = (p.match(/<a href="([^"]+)"/) || [])[1];
    const gorsel = (p.match(/background-image:\s*url\('([^']+)'\)/) || [])[1];
    const baslik = metin((p.match(/<span>([\s\S]*?)<\/span>/) || [])[1] || '');
    const tarih = metin((p.match(/<small>([\s\S]*?)<svg/) || [])[1] || '');
    return link && baslik ? { baslik, tarih, iso: isoTarih(tarih), link: guvenli(link), gorsel: guvenli(gorsel) } : null;
  }).filter(Boolean).slice(0, 12);
}

function kadro(html) {
  return [...html.matchAll(/<article class="tvf-squad__card"[\s\S]*?<\/article>/g)].map(([a]) => ({
    ad: metin((a.match(/tvf-squad__name">([\s\S]*?)</) || [])[1] || ''),
    pozisyon: metin((a.match(/tvf-squad__position">([\s\S]*?)</) || [])[1] || ''),
    foto: guvenli((a.match(/<img[^>]*src="([^"]+)"/) || [])[1]),
    bilgi: [...a.matchAll(/meta-label">([\s\S]*?)<\/span>\s*<span class="tvf-squad__meta-value">([\s\S]*?)<\/span>/g)]
      .map(m => ({ ad: metin(m[1]), deger: metin(m[2]) }))
  })).filter(o => o.ad);
}

module.exports = async (req, res) => {
  const kat = new URL(req.url, 'http://x').searchParams.get('kat') || 'kadin';
  const k = KATEGORILER[kat];
  if (!k) return gonder(res, 400, { hata: 'Bilinmeyen kategori' }, 'no-store');
  try {
    const r = await fetch(TVF + k.yol, { headers: { 'User-Agent': 'Mozilla/5.0 (izmirvoleybolmedya.com)' } });
    if (!r.ok) throw new Error('TVF ' + r.status);
    const html = await r.text();
    const veri = { kat, ad: k.ad, tur: k.tur, kaynak: TVF + k.yol, guncelleme: new Date().toISOString() };
    if (k.tur === 'kadro') veri.kadro = kadro(html); else veri.haberler = haberler(html);
    gonder(res, 200, veri, 's-maxage=600, stale-while-revalidate=3600');
  } catch (e) {
    gonder(res, 502, { hata: 'Milli takım bilgisi şu an alınamadı.' }, 'no-store');
  }
};
