// İzmir Voleybol İl Temsilciliği'nden "Bu Hafta" ve "Gelecek Hafta" maçlarını JSON olarak döndürür.
// Bu haftanın maçları ana sayfada, gelecek hafta ise Maç Takvimi sayfasında yayınlanıyor.
const SITE = 'https://izmir.voleyboliltemsilciligi.com';

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const metin = s => s
  .replace(/<[^>]*>/g, '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(\w+);/g, (m, n) => ENTITY[n] ?? m)
  .replace(/\s+/g, ' ')
  .trim();

// Sayfadaki id'si verilen maç tablosunu, rowspan'leri açıp başlık adlarına göre okur
function tabloOku(html, id) {
  const tablo = (html.match(new RegExp(`<table[^>]*id="${id}"[\\s\\S]*?</table>`, 'i')) || [])[0];
  if (!tablo) return [];
  const trler = tablo.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const basliklar = [...(trler.find(tr => /<th/i.test(tr)) || '').matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => metin(m[1]));
  const sutun = ad => basliklar.findIndex(b => b.startsWith(ad));
  const S = {
    tarih: sutun('Tarih'), salon: sutun('Salon'), saat: sutun('Saat'),
    ev: sutun('Ev Sahibi'), evSet: sutun('A'), misSet: sutun('B'), misafir: sutun('Misafir'),
    setler: sutun('Set'), kume: sutun('Küme')
  };

  const satirlar = [];
  const bekleyen = []; // sütun -> { deger, kalan }
  for (const tr of trler) {
    if (/<th/i.test(tr)) continue;
    const satir = [];
    let col = 0;
    const doldur = () => {
      while (bekleyen[col] && bekleyen[col].kalan > 0) {
        satir[col] = bekleyen[col].deger;
        bekleyen[col].kalan--;
        col++;
      }
    };
    for (const [, attr, ic] of tr.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)) {
      doldur();
      const deger = metin(ic);
      const rs = +(attr.match(/rowspan="?(\d+)/i) || [])[1] || 1;
      satir[col] = deger;
      if (rs > 1) bekleyen[col] = { deger, kalan: rs - 1 };
      col++;
    }
    doldur();
    satirlar.push(satir);
  }
  const al = (s, k) => (S[k] >= 0 && s[S[k]]) || '';
  return satirlar.filter(s => al(s, 'ev') || al(s, 'misafir')).map(s =>
    Object.fromEntries(Object.keys(S).map(k => [k, al(s, k)])));
}

async function sayfa(yol) {
  const r = await fetch(SITE + yol, { headers: { 'User-Agent': 'Mozilla/5.0 (izmirvoleybolmedya.com)' } });
  if (!r.ok) throw new Error('Kaynak ' + r.status);
  return r.text();
}

module.exports = async (req, res) => {
  try {
    const [ana, takvim] = await Promise.all([sayfa('/'), sayfa('/MacTakvimi')]);
    let buHafta = tabloOku(ana, 'icerik_BuHafta_gvmusabakaliste');
    if (!buHafta.length) buHafta = tabloOku(takvim, 'icerik_BuHafta1_gvmusabakaliste');
    const veri = {
      guncelleme: new Date().toISOString(),
      kaynak: SITE,
      buHafta,
      gelecekHafta: tabloOku(takvim, 'icerik_GelecekHafta1_gvmusabakaliste')
    };
    // Vercel önbelleği: 60 sn taze, sonra arka planda yenilenir
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(veri));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ hata: 'Maç takvimi şu an alınamadı.' }));
  }
};
