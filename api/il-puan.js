// İzmir Voleybol İl Temsilciliği puan durumu ve fikstürü:
// /api/il-puan?cins=B&kat=GK&kume=GKSL&yar=<yarışma>
// Sitedeki açılır liste zincirini (Cinsiyet → Kategori → Küme → Yarışma) sunucu tarafında sırayla seçer.
const { SAYFA, ADIMLAR, secenekler, puanTablolari, maclar, oturum, sec } = require('./_il');

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const gonder = (kod, veri, onbellek) => {
    res.statusCode = kod;
    res.setHeader('Cache-Control', onbellek);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(veri));
  };
  try {
    const iste = oturum();
    let html = await iste();
    const secim = {};
    const listeler = { cins: secenekler(html, 'icerik_ddlsbe') };
    for (const [anahtar, alan, id] of ADIMLAR) {
      const deger = q.get(anahtar);
      // Zincir, istenen değer o adımın listesinde varsa ilerler
      if (!deger || !secenekler(html, id).some(o => o.deger === deger)) break;
      html = await sec(iste, html, alan, deger);
      secim[anahtar] = deger;
      const sonraki = ADIMLAR[ADIMLAR.findIndex(a => a[0] === anahtar) + 1];
      if (sonraki) listeler[sonraki[0]] = secenekler(html, sonraki[2]);
    }
    const veri = { secim, listeler, kaynak: SAYFA, guncelleme: new Date().toISOString() };
    if (secim.yar) { veri.tablolar = puanTablolari(html); veri.maclar = maclar(html); }
    gonder(200, veri, 's-maxage=300, stale-while-revalidate=900');
  } catch (e) {
    gonder(502, { hata: 'Puan durumu şu an alınamadı.' }, 'no-store');
  }
};
