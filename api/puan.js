// TVF lig puan durumunu JSON olarak döndürür: /api/puan?lig=sultanlar-ligi&grup=B
const TVF = 'https://tvf.org.tr';
const LIGLER = {
  'sultanlar-ligi': 'Vodafone Sultanlar Ligi',
  'efeler-ligi': 'SMS Grup Efeler Ligi',
  'kadinlar-1-ligi': 'Kadınlar 1. Ligi',
  'erkekler-1-ligi': 'Erkekler 1. Ligi',
  'kadinlar-2-ligi': 'Kadınlar 2. Ligi',
  'erkekler-2-ligi': 'Erkekler 2. Ligi'
};
const UA = { 'User-Agent': 'Mozilla/5.0 (izmirvoleybolmedya.com)' };

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const metin = s => s
  .replace(/<[^>]*>/g, '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(\w+);/g, (m, n) => ENTITY[n] ?? m)
  .replace(/\s+/g, ' ')
  .trim();

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

// Grup seçici: <select ... wire:change="setFilter('GR', ...)"> <option value="A">
function gruplar(html) {
  const sel = html.match(/<select[^>]*setFilter\('(\w+)'[^>]*>([\s\S]*?)<\/select>/i);
  if (!sel) return { tip: '', liste: [] };
  const liste = [...sel[2].matchAll(/<option value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi)]
    .map(m => ({ deger: metin(m[1]), ad: metin(m[2]) }));
  // İlk seçenek bazen <option> etiketi olmadan geliyor; sayfadaki seçili değeri ekle
  const secili = (html.match(/&quot;selectedTypeValue&quot;:&quot;([^&]*)&quot;/) || [])[1];
  if (secili && !liste.some(x => x.deger === secili)) liste.unshift({ deger: secili, ad: 'Grup ' + secili });
  return { tip: sel[1], liste, secili: secili || (liste[0] && liste[0].deger) || '' };
}

// Livewire bileşenine "setFilter" çağrısı göndererek başka bir grubun tablosunu alır
async function grupGetir(sayfaHtml, cerez, tip, deger) {
  const dec = s => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const snapshot = [...sayfaHtml.matchAll(/wire:snapshot="([^"]+)"/g)].map(m => dec(m[1])).find(s => s.includes('selectedType'));
  const csrf = (sayfaHtml.match(/data-csrf="([^"]+)"/) || sayfaHtml.match(/name="csrf-token" content="([^"]+)"/) || [])[1];
  const uri = (sayfaHtml.match(/data-update-uri="([^"]+)"/) || [])[1] || '/livewire/update';
  if (!snapshot || !csrf) throw new Error('Livewire bilgisi yok');
  const r = await fetch(new URL(uri, TVF), {
    method: 'POST',
    headers: { ...UA, 'Content-Type': 'application/json', 'X-Livewire': '', 'X-CSRF-TOKEN': csrf, Cookie: cerez },
    body: JSON.stringify({ _token: csrf, components: [{ snapshot, updates: {}, calls: [{ path: '', method: 'setFilter', params: [tip, deger] }] }] })
  });
  if (!r.ok) throw new Error('Livewire ' + r.status);
  return (await r.json()).components[0].effects.html;
}

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const lig = q.get('lig') || 'sultanlar-ligi';
  const gonder = (kod, veri, onbellek) => {
    res.statusCode = kod;
    res.setHeader('Cache-Control', onbellek);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(veri));
  };
  if (!LIGLER[lig]) return gonder(400, { hata: 'Bilinmeyen lig' }, 'no-store');

  try {
    const r = await fetch(`${TVF}/lig/${lig}`, { headers: UA });
    if (!r.ok) throw new Error('TVF ' + r.status);
    const html = await r.text();
    const g = gruplar(html);
    let grup = q.get('grup') || g.secili;
    let satirlar;
    if (g.liste.length && grup !== g.secili && g.liste.some(x => x.deger === grup)) {
      const cerez = (r.headers.getSetCookie ? r.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ');
      satirlar = tablo(await grupGetir(html, cerez, g.tip, grup));
    } else {
      grup = g.secili;
      satirlar = tablo(html);
    }
    gonder(200, {
      lig, ad: LIGLER[lig], grup, gruplar: g.liste,
      tablo: satirlar, kaynak: `${TVF}/lig/${lig}`, guncelleme: new Date().toISOString()
    }, 's-maxage=120, stale-while-revalidate=600');
  } catch (e) {
    gonder(502, { hata: 'Puan durumu şu an alınamadı.' }, 'no-store');
  }
};
