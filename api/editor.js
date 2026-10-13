// Editör uygulamasının sunucu tarafı: /api/editor?islem=giris|liste|getir|kaydet|sil|gorsel|sondakika|sondakika-kaydet
// Editörler GitHub hesabı olmadan kullanıcı adı/şifreyle girer. GitHub'a yazma işini sunucu,
// GITHUB_ICERIK_TOKEN ile yapar ve yalnızca content/haberler, images/uploads ve content/son-dakika.json'a yazar.
//
// Vercel ortam değişkenleri:
//   GITHUB_ICERIK_TOKEN  Bu repo için "Contents: Read and write" izinli ince ayarlı GitHub token'ı
//   EDITORLER            kullanici:sifre çiftleri, noktalı virgülle ayrılmış (ör. ayse:Gizli123;mehmet:Sifre456)
const crypto = require('crypto');
const supabase = require('./_supabase');

const REPO = 'burakpsikoteknikdm-collab/izmirvoleybolmedya';
const DAL = process.env.EDITOR_DAL || 'main'; // test için başka bir dal verilebilir
const HABER_KLASORU = 'content/haberler';
const GORSEL_KLASORU = 'images/uploads';
const SON_DAKIKA = 'content/son-dakika.json';
const LIGLER = ['sultanlar-ligi', 'efeler-ligi', 'kadinlar-1-ligi', 'erkekler-1-ligi', 'kadinlar-2-ligi', 'erkekler-2-ligi'];
const OTURUM_SURESI = 30 * 864e5;

const token = () => process.env.GITHUB_ICERIK_TOKEN || '';
const imzaAnahtari = () => crypto.createHash('sha256').update('ivm-editor:' + token()).digest();
const ozet = s => crypto.createHash('sha256').update(String(s)).digest('base64url').slice(0, 12);

function editorler() {
  return (process.env.EDITORLER || '').split(/[;\n]/).map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.indexOf(':');
    return i > 0 ? [s.slice(0, i).trim(), s.slice(i + 1)] : null;
  }).filter(Boolean);
}
function esit(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Oturum anahtarı: {kullanıcı, şifre özeti, bitiş}. Şifre değişince ya da editör silinince geçersiz olur.
function oturumVer(kullanici, sifre) {
  const v = Buffer.from(JSON.stringify({ u: kullanici, h: ozet(sifre), exp: Date.now() + OTURUM_SURESI })).toString('base64url');
  return v + '.' + crypto.createHmac('sha256', imzaAnahtari()).update(v).digest('base64url');
}
function oturumDogrula(req) {
  const [v, imza] = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').split('.');
  if (!v || !imza) return null;
  if (!esit(crypto.createHmac('sha256', imzaAnahtari()).update(v).digest('base64url'), imza)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(v, 'base64url').toString()); } catch (e) { return null; }
  if (!p || p.exp < Date.now()) return null;
  const e = editorler().find(([k]) => k === p.u);
  return e && ozet(e[1]) === p.h ? p.u : null;
}

async function gh(yol, secenek = {}) {
  const r = await fetch('https://api.github.com/repos/' + REPO + yol, {
    ...secenek,
    headers: {
      Authorization: 'Bearer ' + token(), Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'izmirvoleybolmedya-editor', ...secenek.headers
    }
  });
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || 'GitHub ' + r.status); e.durum = r.status; throw e; }
  return j;
}
const yolKodla = p => p.split('/').map(encodeURIComponent).join('/');

// Ön bilgi (front matter) — sitedeki okuyucuyla aynı basit biçim
function onBilgiAyristir(yaml) {
  const f = {};
  let liste = null;
  const temiz = v => v.trim().replace(/^["']|["']$/g, '');
  for (const satir of yaml.split('\n')) {
    const m = satir.match(/^\s*-\s+(.*)$/);
    if (m && liste) { f[liste].push(temiz(m[1])); continue; }
    const i = satir.indexOf(':');
    if (i > 0 && !/^\s/.test(satir)) {
      const k = satir.slice(0, i).trim(), v = satir.slice(i + 1).trim();
      if (v === '' || v === '[]') { f[k] = []; liste = k; }
      else if (/^\[.*\]$/.test(v)) { f[k] = v.slice(1, -1).split(',').map(temiz).filter(Boolean); liste = null; }
      else { f[k] = temiz(v); liste = null; }
    }
  }
  return f;
}
function ayristir(t) {
  const m = String(t).replace(/\r\n/g, '\n').match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return null;
  const f = onBilgiAyristir(m[1]);
  f.body = m[2].trim();
  return f;
}
function olustur(h) {
  const tek = s => String(s).replace(/[\r\n]+/g, ' ').replace(/"/g, '”').trim();
  let s = `---\ntitle: "${tek(h.title)}"\ndate: ${h.date}\n`;
  if (h.image) s += `image: ${h.image}\n`;
  if (h.lig) s += `lig: ${h.lig}\n`;
  if (h.bolum) s += `bolum: ${h.bolum}\n`;
  if (h.galeri && h.galeri.length) s += 'galeri:\n' + h.galeri.map(g => `  - ${g}\n`).join('');
  if (h.sabit) s += `sabit: true\n`;
  return s + `---\n${String(h.body || '').replace(/\r\n/g, '\n').trim()}\n`;
}
function kisaAd(s) {
  const tr = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
  return String(s).toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/g, c => tr[c])
    .normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'haber';
}
const gecerliHaberAdi = ad => /^[^/\\]+\.md$/.test(ad || '') && !ad.startsWith('.');

async function govde(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let b = '';
  for await (const parca of req) { b += parca; if (b.length > 6e6) throw Object.assign(new Error('Çok büyük'), { durum: 413 }); }
  return JSON.parse(b || '{}');
}

module.exports = async (req, res) => {
  const gonder = (kod, veri) => {
    res.statusCode = kod;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(veri));
  };
  const islem = new URL(req.url, 'http://x').searchParams.get('islem');
  if (!token() || !editorler().length) return gonder(503, { hata: 'Editör paneli henüz yapılandırılmadı (Vercel ortam değişkenleri eksik).' });

  try {
    if (islem === 'giris') {
      if (req.method !== 'POST') return gonder(405, { hata: 'POST gerekli' });
      const { kullanici, sifre } = await govde(req);
      const e = editorler().find(([k]) => k.toLocaleLowerCase('tr-TR') === String(kullanici || '').trim().toLocaleLowerCase('tr-TR'));
      if (!e || !esit(e[1], sifre || '')) {
        await new Promise(r => setTimeout(r, 800)); // tahmin denemelerini yavaşlat
        return gonder(401, { hata: 'Kullanıcı adı veya şifre hatalı.' });
      }
      return gonder(200, { oturum: oturumVer(e[0], e[1]), kullanici: e[0] });
    }

    const kullanici = oturumDogrula(req);
    if (!kullanici) return gonder(401, { hata: 'Oturum süresi doldu, lütfen tekrar giriş yapın.' });

    if (islem === 'liste') {
      const dosyalar = (await gh(`/contents/${HABER_KLASORU}?ref=${DAL}`).catch(e => e.durum === 404 ? [] : Promise.reject(e)))
        .filter(d => d.type === 'file' && /\.md$/i.test(d.name));
      const liste = await Promise.all(dosyalar.map(async d => {
        // İçerik, dosyanın sha'sına göre okunur: önbellekten eski hali gelmez
        const blob = await gh(`/git/blobs/${d.sha}`);
        const t = Buffer.from(blob.content, 'base64').toString('utf8');
        const f = ayristir(t) || {};
        return { ad: d.name, sha: d.sha, title: f.title || d.name, date: f.date || '', image: f.image || '', lig: f.lig || '', bolum: f.bolum || '', sabit: f.sabit === 'true' };
      }));
      liste.sort((a, b) => new Date(b.date) - new Date(a.date));
      return gonder(200, { kullanici, haberler: liste });
    }

    if (islem === 'getir') {
      const ad = new URL(req.url, 'http://x').searchParams.get('ad');
      if (!gecerliHaberAdi(ad)) return gonder(400, { hata: 'Geçersiz haber' });
      const d = await gh(`/contents/${HABER_KLASORU}/${yolKodla(ad)}?ref=${DAL}`);
      const f = ayristir(Buffer.from(d.content, 'base64').toString('utf8')) || {};
      return gonder(200, { ad, sha: d.sha, title: f.title || '', date: f.date || '', image: f.image || '', galeri: Array.isArray(f.galeri) ? f.galeri : [], lig: f.lig || '', bolum: f.bolum || '', sabit: f.sabit === 'true', body: f.body || '' });
    }

    // Site ayarları ve kurumsal sayfalar (yalnızca bu dosyalar)
    const AYAR_DOSYALARI = { canli: 'content/canli.json', reklam: 'content/reklam.json' };
    const KURUMSAL = { hakkimizda: 'Hakkımızda', kunye: 'Künye', kvkk: 'KVKK Aydınlatma Metni', 'cerez-politikasi': 'Çerez Politikası', 'kullanim-kosullari': 'Kullanım Koşulları' };
    const dosyaOku = async yol => {
      const d = await gh(`/contents/${yol}?ref=${DAL}`).catch(e => e.durum === 404 ? null : Promise.reject(e));
      return d ? { sha: d.sha, metin: Buffer.from(d.content, 'base64').toString('utf8') } : { sha: null, metin: '' };
    };
    if (islem === 'ayar') {
      const dosya = new URL(req.url, 'http://x').searchParams.get('dosya');
      if (!AYAR_DOSYALARI[dosya]) return gonder(400, { hata: 'Geçersiz ayar' });
      const d = await dosyaOku(AYAR_DOSYALARI[dosya]);
      let veri = {};
      try { veri = d.metin ? JSON.parse(d.metin) : {}; } catch (e) {}
      return gonder(200, { sha: d.sha, veri });
    }
    if (islem === 'sayfa') {
      const ad = new URL(req.url, 'http://x').searchParams.get('ad');
      if (!KURUMSAL[ad]) return gonder(400, { hata: 'Geçersiz sayfa' });
      const d = await dosyaOku(`content/sayfalar/${ad}.md`);
      const f = ayristir(d.metin) || {};
      return gonder(200, { sha: d.sha, title: f.title || KURUMSAL[ad], description: f.description || '', body: f.body || '' });
    }

    if (islem === 'sondakika') {
      const d = await gh(`/contents/${SON_DAKIKA}?ref=${DAL}`).catch(e => e.durum === 404 ? null : Promise.reject(e));
      let veri = { haberler: [] };
      if (d) { try { veri = JSON.parse(Buffer.from(d.content, 'base64').toString('utf8')); } catch (e) {} }
      return gonder(200, { sha: d ? d.sha : null, haberler: Array.isArray(veri.haberler) ? veri.haberler : [] });
    }

    if (islem === 'yorumlar') {
      if (!supabase.hazirMi()) return gonder(503, { hata: 'Yorum sistemi henüz yapılandırılmadı.' });
      const durum = new URL(req.url, 'http://x').searchParams.get('durum') === 'onayli' ? 'onayli' : 'bekliyor';
      const yorumlar = await supabase.sb(`/yorumlar?durum=eq.${durum}&select=id,haber,ad,metin,olusturma&order=olusturma.desc&limit=100`);
      const bekleyen = await supabase.sb('/yorumlar?durum=eq.bekliyor&select=id&limit=1', { sayim: true });
      return gonder(200, { yorumlar, bekleyen: bekleyen.toplam });
    }

    if (req.method !== 'POST') return gonder(405, { hata: 'POST gerekli' });
    const g = await govde(req);

    if (islem === 'yorum-onayla' || islem === 'yorum-sil') {
      if (!supabase.hazirMi()) return gonder(503, { hata: 'Yorum sistemi henüz yapılandırılmadı.' });
      const id = parseInt(g.id, 10);
      if (!id) return gonder(400, { hata: 'Geçersiz yorum' });
      if (islem === 'yorum-onayla') await supabase.sb(`/yorumlar?id=eq.${id}`, { method: 'PATCH', body: { durum: 'onayli' } });
      else await supabase.sb(`/yorumlar?id=eq.${id}`, { method: 'DELETE' });
      return gonder(200, { tamam: true });
    }

    if (islem === 'ayar-kaydet') {
      const yol = AYAR_DOSYALARI[g.dosya];
      if (!yol) return gonder(400, { hata: 'Geçersiz ayar' });
      const v = g.veri || {};
      let veri;
      if (g.dosya === 'canli') {
        const url = String(v.youtube_url || '').trim();
        if (url && !/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url)) return gonder(400, { hata: 'YouTube linki https://www.youtube.com/... ya da https://youtu.be/... biçiminde olmalı.' });
        veri = { youtube_url: url, skor_duyuru: String(v.skor_duyuru || '').replace(/\s+/g, ' ').trim().slice(0, 300) };
      } else {
        const link = String(v.link || '').trim();
        if (link && !/^(https:\/\/|mailto:)/i.test(link)) return gonder(400, { hata: 'Bağlantı https:// ya da mailto: ile başlamalı.' });
        veri = { aktif: v.aktif !== false, metin: String(v.metin || '').replace(/\r\n/g, '\n').trim().slice(0, 600), link };
      }
      const sonuc = await gh(`/contents/${yol}`, {
        method: 'PUT',
        body: JSON.stringify({ message: `${g.dosya === 'canli' ? 'Canlı yayın bilgisi' : 'Reklam şeridi'} güncellendi (editör: ${kullanici})`, content: Buffer.from(JSON.stringify(veri, null, 2) + '\n').toString('base64'), sha: g.sha || undefined, branch: DAL })
      });
      return gonder(200, { sha: sonuc.content.sha, veri });
    }

    if (islem === 'sayfa-kaydet') {
      if (!KURUMSAL[g.ad]) return gonder(400, { hata: 'Geçersiz sayfa' });
      const title = String(g.title || '').replace(/[\r\n]+/g, ' ').trim();
      const description = String(g.description || '').replace(/[\r\n]+/g, ' ').trim();
      const body = String(g.body || '').replace(/\r\n/g, '\n').trim();
      if (!title || title.length > 100) return gonder(400, { hata: 'Başlık gerekli (en fazla 100 karakter).' });
      if (description.length > 300) return gonder(400, { hata: 'Kısa açıklama en fazla 300 karakter olabilir.' });
      if (!body || body.length > 60000) return gonder(400, { hata: 'Sayfa içeriği boş olamaz.' });
      const tek = s => s.replace(/"/g, '”');
      const icerik = `---\ntitle: "${tek(title)}"\ndescription: "${tek(description)}"\n---\n${body}\n`;
      const sonuc = await gh(`/contents/content/sayfalar/${g.ad}.md`, {
        method: 'PUT',
        body: JSON.stringify({ message: `${KURUMSAL[g.ad]} sayfası güncellendi (editör: ${kullanici})`, content: Buffer.from(icerik).toString('base64'), sha: g.sha || undefined, branch: DAL })
      });
      return gonder(200, { sha: sonuc.content.sha });
    }

    if (islem === 'sondakika-kaydet') {
      const liste = (Array.isArray(g.haberler) ? g.haberler : []).map(h => ({
        metin: String(h && h.metin || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200),
        link: /^https?:\/\//i.test(String(h && h.link || '').trim()) ? String(h.link).trim().slice(0, 500) : ''
      })).filter(h => h.metin).slice(0, 15);
      const sonuc = await gh(`/contents/${SON_DAKIKA}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: `Son dakika şeridi güncellendi (editör: ${kullanici})`,
          content: Buffer.from(JSON.stringify({ haberler: liste }, null, 2) + '\n').toString('base64'),
          sha: g.sha || undefined, branch: DAL
        })
      });
      return gonder(200, { sha: sonuc.content.sha, haberler: liste });
    }

    if (islem === 'kaydet') {
      const title = String(g.title || '').trim();
      const date = new Date(g.date);
      if (!title || title.length > 200) return gonder(400, { hata: 'Başlık gerekli (en fazla 200 karakter).' });
      if (isNaN(date)) return gonder(400, { hata: 'Geçersiz tarih.' });
      if (String(g.body || '').length > 100000) return gonder(400, { hata: 'Haber metni çok uzun.' });
      const lig = LIGLER.includes(g.lig) ? g.lig : '';
      const bolum = ['takimlar', 'altyapi'].includes(g.bolum) ? g.bolum : '';
      const gorselMi = u => /^\/images\/uploads\/[^/\\\s]+$/.test(u || '');
      const image = gorselMi(g.image) ? g.image : '';
      const galeri = (Array.isArray(g.galeri) ? g.galeri : []).filter(gorselMi).slice(0, 3);
      // Türkiye saatiyle ISO tarih
      const tr = new Date(date.getTime() + 3 * 3600e3).toISOString().replace('Z', '+03:00');
      const icerik = Buffer.from(olustur({ title, date: tr, image, galeri: image ? galeri : [], lig, bolum, sabit: g.sabit === true, body: g.body })).toString('base64');

      let ad = g.ad, sha = g.sha;
      if (ad) {
        if (!gecerliHaberAdi(ad)) return gonder(400, { hata: 'Geçersiz haber' });
      } else {
        const kok = tr.slice(0, 10) + '-' + kisaAd(title);
        ad = kok + '.md';
        for (let i = 2; await gh(`/contents/${HABER_KLASORU}/${yolKodla(ad)}?ref=${DAL}`).then(() => true, () => false); i++) ad = `${kok}-${i}.md`;
        sha = undefined;
      }
      const sonuc = await gh(`/contents/${HABER_KLASORU}/${yolKodla(ad)}`, {
        method: 'PUT',
        body: JSON.stringify({ message: `${g.ad ? 'Haber güncellendi' : 'Yeni haber'}: ${title} (editör: ${kullanici})`, content: icerik, sha, branch: DAL })
      });
      // Yeni haberde abonelere bildirim (hata olursa haber yine kaydedilmiş olur)
      let bildirim = null;
      if (!g.ad && supabase.hazirMi()) {
        const haberAdi = ad.replace(/\.md$/, '');
        bildirim = await supabase.herkeseBildir({ baslik: 'İzmir Voleybol Medya', metin: title, url: '/haber/' + encodeURIComponent(haberAdi), gorsel: image ? 'https://www.izmirvoleybolmedya.com' + image : '', etiket: haberAdi }).catch(() => null);
      }
      return gonder(200, { ad, sha: sonuc.content.sha, bildirim });
    }

    if (islem === 'sil') {
      if (!gecerliHaberAdi(g.ad) || !g.sha) return gonder(400, { hata: 'Geçersiz haber' });
      await gh(`/contents/${HABER_KLASORU}/${yolKodla(g.ad)}`, {
        method: 'DELETE',
        body: JSON.stringify({ message: `Haber silindi: ${g.ad} (editör: ${kullanici})`, sha: g.sha, branch: DAL })
      });
      return gonder(200, { tamam: true });
    }

    if (islem === 'gorsel') {
      const m = String(g.veri || '').match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return gonder(400, { hata: 'Desteklenmeyen görsel (JPEG, PNG veya WebP yükleyin).' });
      const bayt = Buffer.from(m[2], 'base64');
      if (bayt.length > 3.5e6) return gonder(400, { hata: 'Görsel 3,5 MB\'tan küçük olmalı.' });
      const uzanti = m[1] === 'jpeg' ? 'jpg' : m[1];
      const ad = `${new Date().toISOString().slice(0, 10)}-${kisaAd(String(g.ad || 'gorsel').replace(/\.[^.]+$/, ''))}-${crypto.randomBytes(3).toString('hex')}.${uzanti}`;
      await gh(`/contents/${GORSEL_KLASORU}/${yolKodla(ad)}`, {
        method: 'PUT',
        body: JSON.stringify({ message: `Görsel yüklendi: ${ad} (editör: ${kullanici})`, content: m[2], branch: DAL })
      });
      return gonder(200, { yol: `/${GORSEL_KLASORU}/${ad}`, onizleme: `https://raw.githubusercontent.com/${REPO}/${DAL}/${GORSEL_KLASORU}/${encodeURIComponent(ad)}` });
    }

    return gonder(400, { hata: 'Bilinmeyen işlem' });
  } catch (e) {
    if (e.durum === 409 || e.durum === 422) return gonder(409, { hata: 'Bu içerik siz düzenlerken başka biri tarafından değiştirildi. Geri dönüp yeniden açın ve tekrar deneyin.' });
    return gonder(e.durum === 413 ? 413 : 502, { hata: 'İşlem tamamlanamadı: ' + e.message });
  }
};
