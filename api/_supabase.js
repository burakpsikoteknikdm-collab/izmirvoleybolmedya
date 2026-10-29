// Supabase (yorum, beğeni, bildirim aboneliği, haber fotoğrafları) ve web bildirimi için ortak yardımcılar.
// Tablolar yalnızca sunucudan, SUPABASE_SERVICE_KEY ile erişilir (satır güvenliği açık, herkese açık izin yok).
const crypto = require('crypto');

const SUPABASE_URL = 'https://syugifngkyxwkfgklcrd.supabase.co';
const anahtar = () => process.env.SUPABASE_SERVICE_KEY || '';
const hazirMi = () => !!anahtar();

// Supabase REST çağrısı: sb('/yorumlar?select=*', { method, body, prefer, sayim })
async function sb(yol, { method = 'GET', body, prefer, sayim } = {}) {
  const k = anahtar();
  const basliklar = { apikey: k, 'Content-Type': 'application/json' };
  if (k.startsWith('eyJ')) basliklar.Authorization = 'Bearer ' + k; // eski tip service_role anahtarı
  const tercih = [prefer, sayim && 'count=exact'].filter(Boolean).join(',');
  if (tercih) basliklar.Prefer = tercih;
  const r = await fetch(SUPABASE_URL + '/rest/v1' + yol, { method, headers: basliklar, body: body ? JSON.stringify(body) : undefined });
  const metin = await r.text();
  if (!r.ok) {
    const e = new Error('Supabase ' + r.status + ': ' + metin.slice(0, 200));
    e.durum = r.status;
    throw e;
  }
  const veri = metin ? JSON.parse(metin) : null;
  if (sayim) {
    const toplam = +((r.headers.get('content-range') || '').split('/')[1] || 0);
    return { veri, toplam };
  }
  return veri;
}

// Haber fotoğrafını herkese açık "gorseller" deposuna yükler, kalıcı adresini döner.
// Depo yoksa (ilk kullanımda) otomatik oluşturulur. ustuneYaz: aynı adlı dosya varsa değiştir (taşıma için)
const GORSEL_DEPOSU = 'gorseller';
const depoBasliklari = ek => {
  const k = anahtar();
  const b = { apikey: k, ...ek };
  if (k.startsWith('eyJ')) b.Authorization = 'Bearer ' + k;
  return b;
};
async function depoOlustur() {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST', headers: depoBasliklari({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: GORSEL_DEPOSU, name: GORSEL_DEPOSU, public: true, file_size_limit: 5242880, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'] })
  });
  if (!r.ok && r.status !== 409 && !/already exists/i.test(await r.text())) throw new Error('Fotoğraf deposu oluşturulamadı (' + r.status + ')');
}
async function gorselYukle(ad, bayt, tur, ustuneYaz = false) {
  const gonder = () => fetch(`${SUPABASE_URL}/storage/v1/object/${GORSEL_DEPOSU}/${encodeURIComponent(ad)}`, {
    method: 'POST', headers: depoBasliklari({ 'Content-Type': tur, 'x-upsert': String(ustuneYaz), 'cache-control': 'max-age=31536000' }), body: bayt
  });
  let r = await gonder();
  if (!r.ok && /bucket not found/i.test(await r.clone().text())) { await depoOlustur(); r = await gonder(); }
  if (!r.ok) {
    const e = new Error('Fotoğraf depoya yüklenemedi (' + r.status + '): ' + (await r.text()).slice(0, 200));
    e.durum = r.status;
    throw e;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${GORSEL_DEPOSU}/${encodeURIComponent(ad)}`;
}

// IP adresi açık hâliyle saklanmaz; tuzlu özeti kısa süreli kötüye kullanım kontrolü için tutulur
function ipOzeti(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  return crypto.createHmac('sha256', 'ivm-ip:' + anahtar()).update(ip).digest('base64url').slice(0, 22);
}

/* ---------- Web bildirimi (VAPID) ---------- */
// Anahtar çifti Supabase anahtarından türetilir: ayrıca bir gizli anahtar saklamak gerekmez.
function vapid() {
  if (!hazirMi()) return null;
  const ecdh = crypto.createECDH('prime256v1');
  for (let i = 0; ; i++) {
    const d = crypto.createHmac('sha256', anahtar()).update('ivm-vapid-' + i).digest();
    try { ecdh.setPrivateKey(d); break; } catch (e) { if (i > 5) throw e; }
  }
  return { publicKey: ecdh.getPublicKey().toString('base64url'), privateKey: ecdh.getPrivateKey().toString('base64url') };
}

// Tüm abonelere bildirim; geçersizleşen abonelikler silinir
async function herkeseBildir(yuk) {
  if (!hazirMi()) return { gonderilen: 0 };
  const webpush = require('web-push');
  const v = vapid();
  webpush.setVapidDetails('mailto:izmirvoleybolmg@gmail.com', v.publicKey, v.privateKey);
  const aboneler = await sb('/bildirim_aboneleri?select=endpoint,p256dh,auth');
  let gonderilen = 0;
  const veri = JSON.stringify(yuk);
  for (let i = 0; i < aboneler.length; i += 20) {
    await Promise.all(aboneler.slice(i, i + 20).map(async a => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, veri, { TTL: 6 * 3600, urgency: 'normal' });
        gonderilen++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await sb('/bildirim_aboneleri?endpoint=eq.' + encodeURIComponent(a.endpoint), { method: 'DELETE' }).catch(() => {});
        }
      }
    }));
  }
  return { gonderilen, toplam: aboneler.length };
}

module.exports = { SUPABASE_URL, hazirMi, sb, gorselYukle, ipOzeti, vapid, herkeseBildir };
