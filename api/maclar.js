// İzmir Voleybol İl Temsilciliği maç takviminden "Bu Hafta" ve "Gelecek Hafta" maçlarını JSON olarak döndürür.
const KAYNAK = 'https://izmir.voleyboliltemsilciligi.com/MacTakvimi';

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const metin = s => s
  .replace(/<[^>]*>/g, '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(\w+);/g, (m, n) => ENTITY[n] ?? m)
  .replace(/\s+/g, ' ')
  .trim();

// rowspan'leri açarak tabloyu düz satır dizisine çevirir
function tabloOku(html) {
  const satirlar = [];
  const bekleyen = []; // sütun -> { deger, kalan }
  const trler = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trler) {
    if (/<th/i.test(tr)) continue;
    const hucreler = [...tr.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)];
    const satir = [];
    let col = 0;
    const doldur = () => {
      while (bekleyen[col] && bekleyen[col].kalan > 0) {
        satir[col] = bekleyen[col].deger;
        bekleyen[col].kalan--;
        col++;
      }
    };
    for (const [, attr, ic] of hucreler) {
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
  // Sütunlar: Tarih, Salon, Saat, Ev Sahibi, A, B, Misafir, Set Sonuçları, C, Küme, Ktg, Tür, Gr
  return satirlar.filter(s => s[3] || s[6]).map(s => ({
    tarih: s[0] || '', salon: s[1] || '', saat: s[2] || '',
    ev: s[3] || '', evSet: s[4] || '', misSet: s[5] || '', misafir: s[6] || '',
    setler: s[7] || '', kume: s[9] || '', grup: s[12] || ''
  }));
}

function bolum(html, baslik, sonraki) {
  const i = html.indexOf(`<h2>${baslik}</h2>`);
  if (i < 0) return [];
  const j = sonraki ? html.indexOf(`<h2>${sonraki}</h2>`, i) : -1;
  return tabloOku(html.slice(i, j > i ? j : undefined));
}

module.exports = async (req, res) => {
  try {
    const r = await fetch(KAYNAK, { headers: { 'User-Agent': 'Mozilla/5.0 (izmirvoleybolmedya.com)' } });
    if (!r.ok) throw new Error('Kaynak ' + r.status);
    const html = await r.text();
    const veri = {
      guncelleme: new Date().toISOString(),
      kaynak: KAYNAK,
      buHafta: bolum(html, 'Bu Hafta', 'Gelecek Hafta'),
      gelecekHafta: bolum(html, 'Gelecek Hafta')
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
