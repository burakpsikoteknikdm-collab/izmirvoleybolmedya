// İzmir Voleybol İl Temsilciliği puan durumu ve fikstürü:
// /api/il-puan?cins=B&kat=GK&kume=GKSL&yar=<yarışma>
// Sitedeki açılır liste zincirini (Cinsiyet → Kategori → Küme → Yarışma) sunucu tarafında sırayla seçer.
const SITE = 'https://izmir.voleyboliltemsilciligi.com';
const SAYFA = SITE + '/PuanDurumu';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ADIMLAR = [
  ['cins', 'ctl00$icerik$ddlsbe', 'icerik_ddlsbe'],
  ['kat', 'ctl00$icerik$ddlSkategori', 'icerik_ddlSkategori'],
  ['kume', 'ctl00$icerik$ddlskume', 'icerik_ddlskume'],
  ['yar', 'ctl00$icerik$ddlSyarismaadi', 'icerik_ddlSyarismaadi']
];

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const coz = s => String(s)
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(\w+);/g, (m, n) => ENTITY[n] ?? m);
const metin = s => coz(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

// Formdaki gizli alanlar ve seçili değerler (tarayıcının göndereceği gibi; devre dışı alanlar hariç)
function formAlanlari(html) {
  const f = {};
  for (const [t] of html.matchAll(/<input[^>]*>/gi)) {
    const tip = (t.match(/type="([^"]*)"/i) || [])[1] || 'text';
    const ad = (t.match(/name="([^"]*)"/i) || [])[1];
    if (!ad || /submit|button|image|checkbox|radio/i.test(tip) || /disabled/i.test(t)) continue;
    f[coz(ad)] = coz((t.match(/value="([^"]*)"/i) || [])[1] || '');
  }
  for (const m of html.matchAll(/<select([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const ad = (m[1].match(/name="([^"]+)"/i) || [])[1];
    if (!ad || /disabled/i.test(m[1])) continue;
    const secili = (m[2].match(/<option[^>]*selected[^>]*value="([^"]*)"/i) || m[2].match(/<option[^>]*value="([^"]*)"/i) || [])[1];
    f[coz(ad)] = coz(secili || '');
  }
  return f;
}

function secenekler(html, id) {
  const i = html.indexOf(`id="${id}"`);
  if (i < 0) return [];
  const blok = html.slice(i, html.indexOf('</select>', i));
  return [...blok.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/gi)]
    .map(m => ({ deger: coz(m[1]), ad: metin(m[2]) }))
    .filter(o => !/^(0|-1|)$/.test(o.deger));
}

// <span id="icerik_<tablo>_<alan>_<sıra>">değer</span> biçimindeki hücreleri satırlara toplar
function satirlar(html, tablo) {
  const s = [];
  const re = new RegExp(`<(?:span|a) [^>]*id="icerik_${tablo}_(\\w+?)_(\\d+)"[^>]*>([\\s\\S]*?)</(?:span|a)>`, 'g');
  for (const m of html.matchAll(re)) (s[+m[2]] ||= {})[m[1]] = metin(m[3]);
  for (const m of html.matchAll(new RegExp(`id="icerik_${tablo}_imgFoto_(\\d+)"[^>]*src="([^"]+)"`, 'g'))) (s[+m[1]] ||= {}).logo = coz(m[2]);
  return s.filter(Boolean);
}

function puanTablolari(html) {
  const idler = [...new Set([...html.matchAll(/id="icerik_(GvTemplate_\d+)"/g)].map(m => m[1]))];
  return idler.map(id => satirlar(html, id).map((r, i) => ({
    sira: String(i + 1), takim: r.lnkSubmit || '',
    logo: r.logo ? new URL(r.logo, SITE + '/').href : '',
    o: r.gO || '', g: r.gG || '', m: r.gM || '', a: r.gA || '', v: r.gV || '', p: r.gP || ''
  })).filter(r => r.takim)).filter(t => t.length);
}

function maclar(html) {
  return satirlar(html, 'gvmusabakaliste').map(r => ({
    tarih: r.gtarih || '', saat: r.gsaat || '', salon: r.gyer || '',
    ev: r.gevsahibi || '', evSet: r.gseta || '', misSet: r.gsetb || '', misafir: r.gmisafir || '',
    setler: ((r.gsetsonuclari || '').match(/\d+-\d+/g) || []).join(' ')
  })).filter(m => m.ev || m.misafir);
}

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const gonder = (kod, veri, onbellek) => {
    res.statusCode = kod;
    res.setHeader('Cache-Control', onbellek);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(veri));
  };
  try {
    let cerez = '';
    const iste = async (secenek = {}) => {
      const r = await fetch(SAYFA, { ...secenek, headers: { 'User-Agent': UA, Cookie: cerez, ...secenek.headers } });
      if (!r.ok) throw new Error('Kaynak ' + r.status);
      const yeni = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
      if (yeni.length) cerez = yeni.map(c => c.split(';')[0]).join('; ');
      return r.text();
    };
    let html = await iste();
    const secim = {};
    const listeler = { cins: secenekler(html, 'icerik_ddlsbe') };
    for (const [anahtar, alan, id] of ADIMLAR) {
      const deger = q.get(anahtar);
      // Zincir, istenen değer o adımın listesinde varsa ilerler
      if (!deger || !secenekler(html, id).some(o => o.deger === deger)) break;
      const f = formAlanlari(html);
      f[alan] = deger;
      f.__EVENTTARGET = alan;
      f.__EVENTARGUMENT = '';
      html = await iste({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(f).toString() });
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
