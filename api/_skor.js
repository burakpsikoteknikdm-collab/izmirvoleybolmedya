// Canlı skor: editörden girilen, yayın yapılmayan maçların set set skorları.
// Supabase "veri" deposunda canli-skor.json olarak tutulur: { maclar: [...] }
// Maç: { id, takim1, takim2, lig, setler: [[25,17],[17,10]], durum: 'devam'|'bitti', guncelleme }
// durum 'devam' iken son set oynanan settir.
const DOSYA = 'canli-skor.json';
const EN_FAZLA_MAC = 8;
const GORUNME_SURESI = 8 * 3600e3; // son güncellemeden 8 saat sonra sitede gösterilmez

const metin = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const sayi = v => Math.max(0, Math.min(99, parseInt(v, 10) || 0));

// Editörden gelen listeyi doğrular; değişmeyen maçların güncelleme zamanı korunur
function duzenle(gelen, eski = []) {
  if (!Array.isArray(gelen)) throw Object.assign(new Error('Geçersiz skor listesi'), { durum: 400 });
  const eskiler = new Map((eski || []).map(m => [m.id, m]));
  return gelen.slice(0, EN_FAZLA_MAC).map(m => {
    const mac = {
      id: /^[a-z0-9]{6,20}$/.test(m && m.id) ? m.id : Math.random().toString(36).slice(2, 10),
      takim1: metin(m.takim1, 60) || 'Ev Sahibi',
      takim2: metin(m.takim2, 60) || 'Misafir',
      lig: metin(m.lig, 80),
      setler: (Array.isArray(m.setler) ? m.setler : []).slice(0, 5).map(s => [sayi(s && s[0]), sayi(s && s[1])]),
      durum: m.durum === 'bitti' ? 'bitti' : 'devam'
    };
    if (!mac.setler.length) mac.setler.push([0, 0]);
    const e = eskiler.get(mac.id);
    const ayni = e && JSON.stringify([e.takim1, e.takim2, e.lig, e.setler, e.durum]) === JSON.stringify([mac.takim1, mac.takim2, mac.lig, mac.setler, mac.durum]);
    mac.guncelleme = ayni && e.guncelleme ? e.guncelleme : new Date().toISOString();
    return mac;
  });
}

// Sitede gösterilecekler: son 8 saatte güncellenmiş maçlar
const gorunenler = maclar => (maclar || []).filter(m => Date.now() - Date.parse(m.guncelleme || 0) < GORUNME_SURESI);

module.exports = { DOSYA, duzenle, gorunenler };
