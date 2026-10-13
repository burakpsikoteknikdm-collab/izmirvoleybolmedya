// TVF lig fikstürünü haftalara bölünmüş JSON olarak döndürür: /api/fikstur?lig=sultanlar-ligi&grup=B
const { TVF, LIGLER, ligSayfasi, gonder, haftalar } = require('./_tvf');

// "Bu hafta": tarihi bu haftaya (Türkiye saatiyle pazartesi–pazar) denk gelen ilk hafta;
// yoksa bugünden sonraki ilk hafta, o da yoksa son hafta.
function buHaftaIndex(liste) {
  const gun = t => { const [g, a, y] = t.split('.').map(Number); return Date.UTC(y, a - 1, g); };
  const tr = new Date(Date.now() + 3 * 3600e3);
  const bugun = Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate());
  const pzt = bugun - ((tr.getUTCDay() + 6) % 7) * 864e5, pzr = pzt + 6 * 864e5;
  const tarihler = liste.map(h => h.maclar.map(m => gun(m.tarih)).filter(x => !isNaN(x)));
  let i = tarihler.findIndex(d => d.some(x => x >= pzt && x <= pzr));
  if (i < 0) i = tarihler.findIndex(d => d.some(x => x >= bugun));
  return i < 0 ? liste.length - 1 : i;
}

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const lig = q.get('lig') || 'sultanlar-ligi';
  if (!LIGLER[lig]) return gonder(res, 400, { hata: 'Bilinmeyen lig' }, 'no-store');
  try {
    const s = await ligSayfasi(lig, { sekme: 'fikstur', grup: q.get('grup') });
    const liste = haftalar(s.html);
    gonder(res, 200, {
      lig, ad: LIGLER[lig], grup: s.grup, gruplar: s.gruplar,
      haftalar: liste, buHafta: buHaftaIndex(liste),
      kaynak: `${TVF}/lig/${lig}?sekme=fikstur`, guncelleme: new Date().toISOString()
    }, 's-maxage=120, stale-while-revalidate=600');
  } catch (e) {
    gonder(res, 502, { hata: 'Fikstür şu an alınamadı.' }, 'no-store');
  }
};
