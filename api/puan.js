// TVF lig puan durumunu JSON olarak döndürür: /api/puan?lig=sultanlar-ligi&grup=B
const { TVF, LIGLER, ligSayfasi, gonder, tablo } = require('./_tvf');

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const lig = q.get('lig') || 'sultanlar-ligi';
  if (!LIGLER[lig]) return gonder(res, 400, { hata: 'Bilinmeyen lig' }, 'no-store');
  try {
    const s = await ligSayfasi(lig, { grup: q.get('grup') });
    gonder(res, 200, {
      lig, ad: LIGLER[lig], grup: s.grup, gruplar: s.gruplar,
      tablo: tablo(s.html), kaynak: `${TVF}/lig/${lig}`, guncelleme: new Date().toISOString()
    }, 's-maxage=300, stale-while-revalidate=3600');
  } catch (e) {
    gonder(res, 502, { hata: 'Puan durumu şu an alınamadı.' }, 'no-store');
  }
};
