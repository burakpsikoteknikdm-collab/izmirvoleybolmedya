// Ziyaretçi etkileşimleri: /api/etkilesim?islem=...
//  GET  haber&ad=<haber>&cihaz=<id>  → beğeni sayısı, bu cihaz beğendi mi, onaylı yorumlar
//  POST begen   { ad, cihaz }         → beğen / beğeniyi geri al
//  POST yorum   { ad, isim, metin, onay, web }  → yorum onaya gönderilir (web: bot tuzağı, boş olmalı)
//  GET  vapid                          → bildirim aboneliği için açık anahtar
//  POST abone   { abonelik }           → bildirim aboneliği kaydı
//  POST abonelik-iptal { endpoint }
//  POST okundu { ad }                 → haberin okunma sayısını 1 artırır (kişisel veri tutulmaz)
const { hazirMi, sb, ipOzeti, vapid } = require('./_supabase');

const haberAdiMi = ad => typeof ad === 'string' && ad.length > 0 && ad.length < 200 && !/[\/\\]|\.\./.test(ad);
const cihazMi = c => typeof c === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(c);

async function govde(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let b = '';
  for await (const p of req) { b += p; if (b.length > 20000) throw Object.assign(new Error('Çok büyük'), { durum: 413 }); }
  return JSON.parse(b || '{}');
}

module.exports = async (req, res) => {
  const gonder = (kod, veri, onbellek = 'no-store') => {
    res.statusCode = kod;
    res.setHeader('Cache-Control', onbellek);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(veri));
  };
  const q = new URL(req.url, 'http://x').searchParams;
  const islem = q.get('islem');
  if (!hazirMi()) return gonder(503, { hata: 'Yorum ve beğeni sistemi henüz yapılandırılmadı.' });

  try {
    if (islem === 'vapid') return gonder(200, { anahtar: vapid().publicKey }, 's-maxage=86400');

    if (islem === 'haber') {
      const ad = q.get('ad'), cihaz = q.get('cihaz');
      if (!haberAdiMi(ad)) return gonder(400, { hata: 'Geçersiz haber' });
      const h = encodeURIComponent(ad);
      const [begeni, benim, yorumlar] = await Promise.all([
        sb(`/begeniler?haber=eq.${h}&select=cihaz&limit=1`, { sayim: true }),
        cihazMi(cihaz) ? sb(`/begeniler?haber=eq.${h}&cihaz=eq.${encodeURIComponent(cihaz)}&select=cihaz`) : [],
        sb(`/yorumlar?haber=eq.${h}&durum=eq.onayli&select=id,ad,metin,olusturma&order=olusturma.asc&limit=200`)
      ]);
      return gonder(200, { begeni: begeni.toplam, begendim: benim.length > 0, yorumlar });
    }

    if (req.method !== 'POST') return gonder(405, { hata: 'POST gerekli' });
    const g = await govde(req);

    if (islem === 'begen') {
      if (!haberAdiMi(g.ad) || !cihazMi(g.cihaz)) return gonder(400, { hata: 'Geçersiz istek' });
      const h = encodeURIComponent(g.ad), c = encodeURIComponent(g.cihaz);
      const var_ = await sb(`/begeniler?haber=eq.${h}&cihaz=eq.${c}&select=cihaz`);
      if (var_.length) await sb(`/begeniler?haber=eq.${h}&cihaz=eq.${c}`, { method: 'DELETE' });
      else await sb('/begeniler', { method: 'POST', body: { haber: g.ad, cihaz: g.cihaz }, prefer: 'resolution=ignore-duplicates' });
      const say = await sb(`/begeniler?haber=eq.${h}&select=cihaz&limit=1`, { sayim: true });
      return gonder(200, { begeni: say.toplam, begendim: !var_.length });
    }

    if (islem === 'yorum') {
      if (g.web) return gonder(200, { tamam: true }); // bot tuzağı doldurulmuş: sessizce yok say
      const isim = String(g.isim || '').replace(/\s+/g, ' ').trim();
      const metin = String(g.metin || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      if (!haberAdiMi(g.ad)) return gonder(400, { hata: 'Geçersiz haber' });
      if (isim.length < 2 || isim.length > 40) return gonder(400, { hata: 'Adınız 2-40 karakter olmalı.' });
      if (metin.length < 2 || metin.length > 1000) return gonder(400, { hata: 'Yorumunuz 2-1000 karakter olmalı.' });
      if (g.onay !== true) return gonder(400, { hata: 'Yorum kurallarını ve aydınlatma metnini onaylamanız gerekiyor.' });
      if (/(https?:\/\/|www\.)\S+/i.test(metin) && (metin.match(/https?:\/\/|www\./gi) || []).length > 1) return gonder(400, { hata: 'Yorumlarda birden fazla bağlantı paylaşılamaz.' });
      const ip = ipOzeti(req);
      const onDk = new Date(Date.now() - 10 * 60e3).toISOString();
      const son = await sb(`/yorumlar?ip_ozet=eq.${ip}&olusturma=gte.${onDk}&select=id`, { sayim: true });
      if (son.toplam >= 3) return gonder(429, { hata: 'Çok sık yorum gönderdiniz. Lütfen birkaç dakika sonra tekrar deneyin.' });
      await sb('/yorumlar', { method: 'POST', body: { haber: g.ad, ad: isim, metin, ip_ozet: ip } });
      return gonder(200, { tamam: true });
    }

    if (islem === 'okundu') {
      if (!haberAdiMi(g.ad)) return gonder(400, { hata: 'Geçersiz haber' });
      // Arama motoru botları ve önizleme robotları sayılmaz
      if (/bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse/i.test(req.headers['user-agent'] || '')) return gonder(200, { tamam: true });
      await sb('/rpc/okunma_arttir', { method: 'POST', body: { h: g.ad } });
      return gonder(200, { tamam: true });
    }

    if (islem === 'abone') {
      const a = g.abonelik || {};
      if (typeof a.endpoint !== 'string' || !/^https:\/\//.test(a.endpoint) || a.endpoint.length > 1000 || !a.keys || !a.keys.p256dh || !a.keys.auth) return gonder(400, { hata: 'Geçersiz abonelik' });
      await sb('/bildirim_aboneleri', { method: 'POST', body: { endpoint: a.endpoint, p256dh: String(a.keys.p256dh).slice(0, 200), auth: String(a.keys.auth).slice(0, 100) }, prefer: 'resolution=merge-duplicates' });
      return gonder(200, { tamam: true });
    }

    if (islem === 'abonelik-iptal') {
      if (typeof g.endpoint !== 'string') return gonder(400, { hata: 'Geçersiz istek' });
      await sb('/bildirim_aboneleri?endpoint=eq.' + encodeURIComponent(g.endpoint), { method: 'DELETE' });
      return gonder(200, { tamam: true });
    }

    return gonder(400, { hata: 'Bilinmeyen işlem' });
  } catch (e) {
    return gonder(e.durum === 413 ? 413 : 502, { hata: 'İşlem şu an yapılamadı. Lütfen daha sonra tekrar deneyin.' });
  }
};
