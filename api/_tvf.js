// TVF lig sayfalarını okumak için ortak yardımcılar (alt çizgili dosyalar Vercel'de ayrı fonksiyon olmaz)
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
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(\w+);/g, (m, n) => ENTITY[n] ?? m)
  .replace(/\s+/g, ' ')
  .trim();

// Grup seçici: <select ... wire:change="setFilter('GR', ...)"> <option value="A">
function gruplar(html) {
  const sel = html.match(/<select[^>]*setFilter\('(\w+)'[^>]*>([\s\S]*?)<\/select>/i);
  if (!sel) return { tip: '', liste: [], secili: '' };
  const liste = [...sel[2].matchAll(/<option value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi)]
    .map(m => ({ deger: metin(m[1]), ad: metin(m[2]) }));
  // İlk seçenek bazen <option> etiketi olmadan geliyor; sayfadaki seçili değeri ekle
  const secili = (html.match(/&quot;selectedTypeValue&quot;:&quot;([^&]*)&quot;/) || [])[1];
  if (secili && !liste.some(x => x.deger === secili)) liste.unshift({ deger: secili, ad: 'Grup ' + secili });
  return { tip: sel[1], liste, secili: secili || (liste[0] && liste[0].deger) || '' };
}

// Lig sayfasını (istenirse fikstür sekmesiyle) indirir; varsayılan dışındaki bir grup istenirse
// Livewire bileşenine "setFilter" çağrısı gönderip o grubun HTML'ini döndürür.
async function ligSayfasi(lig, { sekme, grup } = {}) {
  const r = await fetch(`${TVF}/lig/${lig}${sekme ? '?sekme=' + sekme : ''}`, { headers: UA });
  if (!r.ok) throw new Error('TVF ' + r.status);
  const html = await r.text();
  const g = gruplar(html);
  if (!g.liste.length || !grup || grup === g.secili || !g.liste.some(x => x.deger === grup)) {
    return { html, gruplar: g.liste, grup: g.secili };
  }
  const dec = s => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const snapshot = [...html.matchAll(/wire:snapshot="([^"]+)"/g)].map(m => dec(m[1])).find(s => s.includes('selectedType'));
  const csrf = (html.match(/data-csrf="([^"]+)"/) || html.match(/name="csrf-token" content="([^"]+)"/) || [])[1];
  const uri = (html.match(/data-update-uri="([^"]+)"/) || [])[1] || '/livewire/update';
  if (!snapshot || !csrf) throw new Error('Livewire bilgisi yok');
  const cerez = (r.headers.getSetCookie ? r.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ');
  const u = await fetch(new URL(uri, TVF), {
    method: 'POST',
    headers: { ...UA, 'Content-Type': 'application/json', 'X-Livewire': '', 'X-CSRF-TOKEN': csrf, Cookie: cerez },
    body: JSON.stringify({ _token: csrf, components: [{ snapshot, updates: {}, calls: [{ path: '', method: 'setFilter', params: [g.tip, grup] }] }] })
  });
  if (!u.ok) throw new Error('Livewire ' + u.status);
  return { html: (await u.json()).components[0].effects.html, gruplar: g.liste, grup };
}

function gonder(res, kod, veri, onbellek) {
  res.statusCode = kod;
  res.setHeader('Cache-Control', onbellek);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(veri));
}

module.exports = { TVF, LIGLER, metin, ligSayfasi, gonder };
