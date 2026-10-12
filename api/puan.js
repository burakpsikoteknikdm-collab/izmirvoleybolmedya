// TVF lig puan durumunu JSON olarak döndürür: /api/puan?lig=sultanlar-ligi&grup=B
const { TVF, LIGLER, metin, ligSayfasi, gonder } = require('./_tvf');

function tablo(html) {
  const t = (html.match(/tvf-standings[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i) || [])[1] || '';
  return (t.match(/<tr[\s\S]*?<\/tr>/gi) || []).map(tr => {
    const td = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
    if (td.length < 9) return null;
    const logo = (td[1].match(/<img[^>]*src="([^"]+)"/i) || [])[1] || '';
    const [sira, , o, g, m, p, a, v, sav] = td.map(metin);
    return { sira, takim: metin(td[1]), logo: /^https:\/\//.test(logo) && !/logoyok/i.test(logo) ? logo : '', o, g, m, p, a, v, sav };
  }).filter(Boolean);
}

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const lig = q.get('lig') || 'sultanlar-ligi';
  if (!LIGLER[lig]) return gonder(res, 400, { hata: 'Bilinmeyen lig' }, 'no-store');
  try {
    const s = await ligSayfasi(lig, { grup: q.get('grup') });
    gonder(res, 200, {
      lig, ad: LIGLER[lig], grup: s.grup, gruplar: s.gruplar,
      tablo: tablo(s.html), kaynak: `${TVF}/lig/${lig}`, guncelleme: new Date().toISOString()
    }, 's-maxage=120, stale-while-revalidate=600');
  } catch (e) {
    gonder(res, 502, { hata: 'Puan durumu şu an alınamadı.' }, 'no-store');
  }
};
