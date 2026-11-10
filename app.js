/*
 * Lampu Pindar: cek dulu sebelum pinjam
 * Hak Cipta (c) 2026 Muhammad Ramadhani Kesuma (mrk29)
 * Lab. Teknologi Keuangan, FEB Universitas Mulawarman, Samarinda
 * build: mrk29-v1.0
 *
 * Seluruh perhitungan berjalan di browser pengguna. Tidak ada data yang dikirim.
 * Bagian 1 (ATURAN dan fungsi inti) sengaja dipisah dan tanpa akses DOM
 * agar dapat diuji otomatis dan diperbarui ketika OJK mengubah aturan.
 */
'use strict';

/* =========================================================
 * 1. ATURAN OJK DAN FUNGSI INTI
 * ========================================================= */
const ATURAN = {
  versi: 'mrk29-v1.0 (November 2026)',
  hariPerBulan: 30,                // konvensi contoh hitungan SEOJK 19/2025 Romawi XIV.3 (5 bulan = 150 hari)
  batasTenorPendek: 180,           // "tenor sampai dengan 6 bulan"
  batasNilaiProduktif: 50e6,       // Rp50 juta
  plafonTotal: 1.0,                // manfaat ekonomi + denda maks. 100% nilai pendanaan (XIV.5)
  rasioBayarMaks: 0.30,            // sejak 2026 (XIII.2.b)
  batasPendanaanPerPenerima: 2e9,  // POJK 40/2024 Pasal 137
  twpMaks: 5,                      // POJK 40/2024 Pasal 172 ayat (3), dalam persen
  sumber: {
    me: 'SEOJK 19/SEOJK.06/2025 Romawi XIV angka 2',
    batas: 'SEOJK 19/SEOJK.06/2025 Romawi XIV angka 3',
    denda: 'SEOJK 19/SEOJK.06/2025 Romawi XIV angka 4',
    plafon: 'SEOJK 19/SEOJK.06/2025 Romawi XIV angka 5',
    mampu: 'SEOJK 19/SEOJK.06/2025 Romawi XIII angka 2',
    akses: 'SEOJK 19/SEOJK.06/2025 Romawi VII angka 1',
    tawaran: 'POJK 40/2024 Pasal 158 huruf k',
    twp: 'POJK 40/2024 Pasal 172 ayat (2) dan (3)',
    maks: 'POJK 40/2024 Pasal 137'
  }
};

/** Batas manfaat ekonomi per hari (dalam persen) menurut jenis, nilai, dan tenor. */
function batasHarian(jenis, P, T) {
  const pendek = T <= ATURAN.batasTenorPendek;
  if (jenis === 'produktif') {
    if (P <= ATURAN.batasNilaiProduktif) {
      return pendek ? { persen: 0.275, dasar: 'huruf a angka 1) a): produktif sampai Rp50 juta, tenor sampai 6 bulan' }
                    : { persen: 0.1, dasar: 'huruf a angka 1) b): produktif sampai Rp50 juta, tenor di atas 6 bulan' };
    }
    return { persen: 0.1, dasar: 'huruf a angka 2): produktif di atas Rp50 juta' };
  }
  return pendek ? { persen: 0.3, dasar: 'huruf b angka 1): konsumtif, tenor sampai 6 bulan' }
                : { persen: 0.2, dasar: 'huruf b angka 2): konsumtif, tenor di atas 6 bulan' };
}

/**
 * Hitung satu tawaran.
 * inp: { jenis, P, mode:'total'|'cicilan'|'rincian', B, tenor, satuan:'hari'|'bulan',
 *        c, n, frek, bunga, admin, lain, adminDipotong, potongan, caraBayar:'akhir'|'bulanan',
 *        penghasilan, cicilanLain, dendaPersen }
 */
function hitung(inp) {
  const o = { errors: [], info: [] };
  const P = +inp.P || 0;
  let T, B, D, ME;
  if (inp.mode === 'cicilan') {
    const c = +inp.c || 0, n = +inp.n || 0, f = +inp.frek || 30;
    T = n * f; B = c * n; D = P - (+inp.potongan || 0); ME = B - D;
    if (!c || !n) o.errors.push('Isi besar cicilan dan jumlah cicilan.');
  } else if (inp.mode === 'rincian') {
    T = (+inp.tenor || 0) * (inp.satuan === 'bulan' ? ATURAN.hariPerBulan : 1);
    const bunga = +inp.bunga || 0, admin = +inp.admin || 0, lain = +inp.lain || 0;
    ME = bunga + admin + lain;
    D = P - (inp.adminDipotong ? admin : 0);
    B = P + bunga + lain + (inp.adminDipotong ? 0 : admin);
    if (!ME) o.errors.push('Isi paling tidak salah satu komponen biaya.');
  } else {
    T = (+inp.tenor || 0) * (inp.satuan === 'bulan' ? ATURAN.hariPerBulan : 1);
    B = +inp.B || 0; D = P - (+inp.potongan || 0); ME = B - D;
    if (!B) o.errors.push('Isi total yang harus dibayar kembali.');
  }
  if (!P) o.errors.unshift('Isi nilai pinjaman di perjanjian.');
  if (!T) o.errors.push('Isi tenor.');
  if (P && D <= 0) o.errors.push('Potongan tidak boleh sama dengan atau lebih besar dari nilai pinjaman.');
  if (o.errors.length === 0 && ME < 0) o.errors.push('Total bayar lebih kecil dari uang yang Anda terima. Periksa kembali angkanya.');
  if (o.errors.length) return o;

  const bat = batasHarian(inp.jenis, P, T);
  const L = bat.persen / 100;
  const r = ME / (P * T);                  // rumus resmi OJK
  const rRiil = ME / (D * T);              // terhadap uang yang benar-benar diterima
  Object.assign(o, {
    P, T, B, D, ME, r, rRiil, L, bat,
    potongan: P - D,
    meMaks: L * P * T,
    per100rb: rRiil * 1e5,
    tahunan: rRiil * 365,
    rasioBiaya: ME / P
  });
  o.wajar = r > L + 1e-12 ? 'crit' : 'good';     // dua warna, langsung dari aturan
  o.pakaiBatas = r / L;                          // informasi: porsi batas yang terpakai
  if (ME > P * ATURAN.plafonTotal) o.info.push('Biaya pinjaman ini saja sudah melebihi 100% nilai pinjaman, padahal OJK membatasi biaya ditambah denda paling banyak 100%.');
  if (P > ATURAN.batasPendanaanPerPenerima) o.info.push('Nilai di atas Rp2 miliar melebihi batas pendanaan per penerima (POJK 40/2024 Pasal 137), kecuali pendanaan produktif yang memenuhi syarat hingga Rp5 miliar.');

  // Kewajiban per bulan pinjaman ini
  if (inp.mode === 'cicilan') o.K = (+inp.c) * ATURAN.hariPerBulan / (+inp.frek || 30);
  else if (inp.caraBayar === 'bulanan' && T > ATURAN.hariPerBulan) o.K = B / (T / ATURAN.hariPerBulan);
  else o.K = B;
  const gaji = +inp.penghasilan || 0, lainC = +inp.cicilanLain || 0;
  o.cicilanLain = lainC;
  if (gaji > 0) {
    o.gaji = gaji;
    o.R = (o.K + lainC) / gaji;
    o.sisa = gaji - o.K - lainC;
    o.mampu = o.R > ATURAN.rasioBayarMaks + 1e-12 ? 'crit' : 'good';
    o.ruangCicilan = ATURAN.rasioBayarMaks * gaji - o.K - lainC;
  } else o.mampu = 'warn';

  // Denda keterlambatan
  const dp = inp.dendaPersen === '' || inp.dendaPersen == null || isNaN(+inp.dendaPersen) ? bat.persen : +inp.dendaPersen;
  o.dendaPersen = dp;
  o.dendaMelebihi = dp > bat.persen + 1e-9;
  o.dendaHarian = dp / 100 * P;
  o.ruangDenda = Math.max(0, P * ATURAN.plafonTotal - ME);
  o.hariPlafon = o.dendaHarian > 0 ? o.ruangDenda / o.dendaHarian : Infinity;
  return o;
}

/** Denda setelah x hari terlambat, dibatasi plafon 100%. */
function dendaSetelah(o, hari) {
  return Math.min(o.dendaHarian * hari, o.ruangDenda);
}

/**
 * Status kesehatan dua dimensi (dalam persen).
 * Kualitas: TWP90 dibanding nasional dan batas 5%.
 * Laju: pertumbuhan outstanding setahun dibanding median dan kuartil atas 38 provinsi.
 */
function statusKesehatan(twp, twpNas, tumbuh, median, q3) {
  const q = twp > ATURAN.twpMaks ? 2 : (twp > twpNas ? 1 : 0);
  const g = tumbuh > q3 ? 2 : (tumbuh > median ? 1 : 0);
  const skor = q + g;
  let lvl = skor === 0 ? 0 : skor <= 2 ? 1 : skor === 3 ? 2 : 3;
  if (q === 2) lvl = Math.max(lvl, 2);
  return { q, g, lvl };
}

/** Kuartil dengan metode eksklusif (sama dengan QUARTILE.EXC di Excel). */
function kuartil(arr, p) {
  const s = arr.filter(v => v != null && isFinite(v)).sort((x, y) => x - y);
  const h = (s.length + 1) * p;
  if (h <= 1) return s[0];
  if (h >= s.length) return s[s.length - 1];
  const lo = Math.floor(h);
  return s[lo - 1] + (h - lo) * (s[lo] - s[lo - 1]);
}

const MRK29 = { build: 'mrk29-v1.0', ATURAN, batasHarian, hitung, dendaSetelah, statusKesehatan, kuartil };
if (typeof module !== 'undefined') module.exports = MRK29;
if (typeof window !== 'undefined') window.MRK29 = MRK29;
if (typeof document === 'undefined') { /* lingkungan uji */ } else init();

/* =========================================================
 * 2. UTILITAS TAMPILAN
 * ========================================================= */
function init() {
try { console.log('%c Lampu Pindar %c mrk29-v1.0 ', 'background:#0b3a46;color:#fff;padding:3px 6px;border-radius:4px 0 0 4px', 'background:#f4c35a;color:#0b3a46;padding:3px 6px;border-radius:0 4px 4px 0', '\nHak Cipta (c) 2026 Muhammad Ramadhani Kesuma. Lab. Teknologi Keuangan FEB Unmul.'); } catch (_) {}
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const nf = (d = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const rp = x => (x < 0 ? '-Rp' : 'Rp') + nf(0).format(Math.round(Math.abs(x)));
const pct = (x, d = 1) => nf(d).format(x) + '%';
const pctR = x => pct(x * 100, x * 100 < 0.1 ? 3 : (x * 100 < 1 ? 3 : 2));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const digits = s => +(String(s || '').replace(/\D/g, '')) || 0;
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_P = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const ymLabel = (ym, panjang) => { const [y, m] = ym.split('-'); return panjang ? `${BULAN_P[m - 1]} ${y}` : `${BULAN[m - 1]} ${y.slice(2)}`; };
const rpM = m => m >= 1000 ? 'Rp' + nf(2).format(m / 1000) + ' T' : 'Rp' + nf(m < 100 ? 1 : 0).format(m) + ' M'; // input miliar
const rpJt = x => 'Rp' + nf(2).format(x / 1e6) + ' jt';

const ICON = {
  good: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 2L23 21H1z" fill="currentColor"/><path d="M12 9v5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.5" r="1.4" fill="#fff"/></svg>',
  serious: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M12 6.5v7" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.4" fill="#fff"/></svg>',
  crit: '<svg viewBox="0 0 24 24"><path d="M8 1h8l7 7v8l-7 7H8l-7-7V8z" fill="currentColor"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',
  neutral: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.5 9.3a2.6 2.6 0 115 1c-.6 1-2.5 1.5-2.5 3.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.2" fill="currentColor"/></svg>'
};
const vcard = (q, cls, label, text) =>
  `<div class="vcard ${cls}"><div class="q">${q}<span class="mini-lamp s-${cls}" aria-hidden="true"><i></i><i></i><i></i></span></div><div class="badge">${ICON[cls]}<span>${label}</span></div><p>${text}</p></div>`;

/* ---------- Router ---------- */
const VIEWS = ['kalkulator', 'bandingkan', 'kesehatan', 'metode'];
function route() {
  const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'kalkulator';
  VIEWS.forEach(n => { $('#v-' + n).hidden = n !== v; });
  $$('.tabs a, .bottomnav a').forEach(a => { if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (v === 'kesehatan') renderKesehatan();
  window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', route);

/* ---------- Format isian rupiah ---------- */
function bindMoney(root) {
  root.addEventListener('input', e => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || t.type !== 'text' && t.type !== '') return;
    if (t.dataset.plain !== undefined || ['n', 'tenor', 'dendaPersen'].includes(t.name)) {
      if (t.name !== 'dendaPersen') t.value = t.value.replace(/\D/g, '');
      return;
    }
    const before = t.value, pos = t.selectionStart, digitsBefore = before.slice(0, pos).replace(/\D/g, '').length;
    const d = before.replace(/\D/g, '');
    t.value = d ? nf(0).format(+d) : '';
    let i = 0, seen = 0;
    while (i < t.value.length && seen < digitsBefore) { if (/\d/.test(t.value[i])) seen++; i++; }
    try { t.setSelectionRange(i, i); } catch (_) {}
  }, true);
}

/* =========================================================
 * 3. KALKULATOR
 * ========================================================= */
const form = $('#f-kalk');
bindMoney(form);
let legal = { izin: null, akses: null, tawaran: null, jelas: null };
let hariTelat = 30;
let dendaInput = '';

function bacaForm() {
  const g = n => form.elements[n];
  return {
    jenis: form.querySelector('[name=jenis]:checked').value,
    mode: form.querySelector('[name=mode]:checked').value,
    P: digits(g('P').value), B: digits(g('B').value),
    c: digits(g('c').value), n: digits(g('n').value), frek: +g('frek').value,
    bunga: digits(g('bunga').value), admin: digits(g('admin').value), lain: digits(g('lain').value),
    adminDipotong: g('adminDipotong').checked,
    tenor: digits(g('tenor').value), satuan: g('satuan').value,
    potongan: digits(g('potongan').value), caraBayar: g('caraBayar').value,
    penghasilan: digits(g('penghasilan').value), cicilanLain: digits(g('cicilanLain').value),
    dendaPersen: dendaInput === '' ? '' : +String(dendaInput).replace(',', '.')
  };
}

function aturMode() {
  const m = form.querySelector('[name=mode]:checked').value;
  $$('[data-mode]', form).forEach(el => { el.hidden = el.dataset.mode !== m; });
  $('[data-tenor]', form).hidden = m === 'cicilan';
  $('[data-potongan]', form).hidden = m === 'rincian';
  $('[data-carabayar]', form).hidden = m === 'cicilan';
}

function adaIsian(i) { return i.P || i.B || i.c || i.bunga || i.tenor; }

function renderKalk() {
  const inp = bacaForm();
  const box = $('#hasil');
  if (!adaIsian(inp)) {
    box.innerHTML = `<div class="card empty"><span class="lamp lamp-big" aria-hidden="true"><i></i><i></i><i></i></span><p><b>Lampu belum menyala.</b><br>Isi nilai pinjaman, biaya, dan tenor, atau tekan salah satu contoh.</p></div>`;
    return;
  }
  const o = hitung(inp);
  if (o.errors.length) {
    box.innerHTML = `<div class="panel"><div class="err">${o.errors.map(esc).join('<br>')}</div></div>`;
    return;
  }
  const konsumtif = inp.jenis === 'konsumtif';

  // Putusan WAJAR
  const wajarTxt = {
    good: ['Dalam batas OJK', `Biayanya ${pctR(o.r)} per hari. Batasnya ${pct(o.bat.persen, 3)}, jadi tawaran ini memakai ${pct(o.pakaiBatas * 100, 0)} dari biaya maksimum yang boleh dikenakan.`],
    crit: ['Melebihi batas OJK', `Biayanya ${pctR(o.r)} per hari, padahal batasnya ${pct(o.bat.persen, 3)}. Ada kelebihan ${rp(o.ME - o.meMaks)}.`]
  }[o.wajar];

  // Putusan MAMPU
  let mampu;
  if (o.mampu === 'warn') mampu = ['Belum bisa dinilai', 'Isi penghasilan di langkah 3 supaya lampu ini bisa menyala.'];
  else {
    const catProd = konsumtif ? '' : ' Untuk pinjaman produktif, 30% dipakai sebagai panduan.';
    mampu = {
      good: ['Dalam batas 30%', `Semua cicilan Anda ${pct(o.R * 100)} dari penghasilan. Masih ada ruang ${rp(o.ruangCicilan)} per bulan sebelum menyentuh 30%.${catProd}`],
      crit: [konsumtif ? 'Melewati batas 30%' : 'Di atas panduan 30%', `Semua cicilan Anda ${pct(o.R * 100)} dari penghasilan, lebih ${rp(-o.ruangCicilan)} per bulan dari batas 30%. ${konsumtif ? 'Penyelenggara berizin seharusnya tidak menyetujui pinjaman ini.' : 'Arus kas usaha Anda akan tertekan.'}${catProd}`]
    }[o.mampu];
  }

  // Putusan LEGAL
  const jaw = Object.values(legal);
  const nYa = jaw.filter(v => v === true).length;
  let lg;
  if (o.wajar === 'crit') lg = ['crit', 'Tanda bahaya', 'Pindar berizin wajib mematuhi batas biaya. Kalau angka yang Anda masukkan sudah benar, kemungkinan besar tawaran ini bukan dari penyelenggara berizin.'];
  else if (jaw.includes(false)) lg = ['crit', 'Tanda bahaya', `Ada ciri pinjol ilegal pada jawaban Anda di langkah 4 (${jaw.filter(v => v === false).length} dari 4 ciri tidak terpenuhi).`];
  else if (nYa === 4) lg = ['good', 'Ciri legal terpenuhi', 'Biaya dalam batas dan keempat ciri penyelenggara berizin terpenuhi. Simpan salinan perjanjian Anda.'];
  else if (jaw.includes('?')) lg = ['warn', 'Belum bisa dipastikan', `${nYa} dari 4 ciri terpenuhi, sisanya belum Anda ketahui. Cek dulu lewat petunjuk di langkah 4 sebelum menyetujui.`];
  else lg = ['warn', 'Belum bisa dipastikan', `${nYa} dari 4 ciri sudah terpenuhi. Jawab sisanya di langkah 4 supaya lampu ini bisa menyala.`];

  // Meter wajar
  const skala = Math.max(o.bat.persen * 2, o.r * 100 * 1.08);
  const fillW = Math.min(100, o.r * 100 / skala * 100), markL = o.bat.persen / skala * 100;
  const fillCol = { good: 'var(--good)', crit: 'var(--crit)' }[o.wajar];

  // Meter mampu
  let mampuBlock = '';
  if (o.mampu !== 'warn') {
    const sk = Math.max(0.6, o.R * 1.08), fw = Math.min(100, o.R / sk * 100), mk = 0.30 / sk * 100;
    const col = { good: 'var(--good)', crit: 'var(--crit)' }[o.mampu];
    mampuBlock = `
    <div class="panel block">
      <h3>Kemampuan bayar</h3>
      <div class="meter"><div class="meter-track"><div class="meter-fill" style="width:${fw}%;background:${col}"></div><div class="meter-mark" style="left:${mk}%"><span>30%</span></div></div>
      <div class="meter-legend"><span>0%</span><span>${pct(o.R * 100)} dari penghasilan</span></div></div>
      <dl class="kv">
        <dt>Kewajiban per bulan pinjaman ini</dt><dd>${rp(o.K)}${inp.mode !== 'cicilan' && (inp.caraBayar === 'akhir' || o.T <= 30) ? '<small>dibayar sekaligus pada bulan jatuh tempo</small>' : ''}</dd>
        <dt>Cicilan lain ke semua kreditur</dt><dd>${rp(o.cicilanLain)}</dd>
        <dt>Penghasilan bersih per bulan</dt><dd>${rp(o.gaji)}</dd>
        <dt>${o.ruangCicilan >= 0 ? 'Ruang cicilan sampai batas 30%' : 'Kelebihan dari batas 30%'}</dt><dd style="color:${o.ruangCicilan < 0 ? 'var(--crit)' : 'inherit'}">${rp(Math.abs(o.ruangCicilan))}</dd>
        <div class="total" style="display:contents"><dt>Sisa untuk kebutuhan hidup</dt><dd>${rp(o.sisa)}</dd></div>
      </dl>
      <p class="src"><b>Dasar:</b> ${ATURAN.sumber.mampu}. Batas 40% pada 2025 dan 30% sejak 2026, dihitung dari pembayaran ke seluruh kreditur (pindar, bank, perusahaan pembiayaan, pegadaian, dan lainnya)${konsumtif ? '' : '. Ketentuan ini wajib untuk pendanaan konsumtif'}.</p>
    </div>`;
  }

  // Simulasi terlambat
  const maxHari = Math.max(30, Math.min(720, isFinite(o.hariPlafon) ? Math.ceil(o.hariPlafon) + 15 : 90));
  hariTelat = Math.min(hariTelat, maxHari);
  const denda = dendaSetelah(o, hariTelat);
  const beban = (o.ME + denda) / o.P;
  const telatBlock = `
    <div class="panel block">
      <h3>Kalau terlambat bayar?</h3>
      <label class="field" style="margin-top:0"><span>Terlambat <b id="hari-out">${hariTelat}</b> hari</span>
        <input type="range" id="hari" min="0" max="${maxHari}" value="${hariTelat}" aria-label="Jumlah hari terlambat"></label>
      <div class="meter" style="margin-top:22px"><div class="meter-track">
        <div class="meter-fill" style="width:${Math.min(100, o.ME / o.P * 100)}%;background:var(--s1);border-radius:99px 0 0 99px"></div>
        <div class="meter-fill" style="left:${Math.min(100, o.ME / o.P * 100)}%;width:${Math.min(100 - Math.min(100, o.ME / o.P * 100), denda / o.P * 100)}%;background:var(--crit);border-radius:0 99px 99px 0"></div>
        <div class="meter-mark end" style="left:100%"><span>Plafon 100%</span></div></div>
        <div class="meter-legend"><span><span style="white-space:nowrap"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--s1)"></i> biaya ${pct(o.ME / o.P * 100)}</span> &nbsp; <span style="white-space:nowrap"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--crit)"></i> denda ${pct(denda / o.P * 100)}</span></span><span>beban ${pct(Math.min(100, beban * 100))} dari pinjaman</span></div></div>
      <dl class="kv">
        <dt>Denda per hari (${pct(o.dendaPersen, 3)} × nilai pinjaman)</dt><dd>${rp(o.dendaHarian)}</dd>
        <dt>Total denda setelah ${hariTelat} hari</dt><dd>${rp(denda)}</dd>
        <div class="total" style="display:contents"><dt>Total yang harus dibayar</dt><dd>${rp(o.B + denda)}</dd></div>
      </dl>
      <div class="insight">${o.ruangDenda <= 0
        ? 'Biaya pinjaman ini sudah menghabiskan plafon 100%, sehingga secara aturan tidak ada lagi ruang untuk denda.'
        : `Denda berhenti bertambah setelah sekitar <b>${nf(0).format(Math.ceil(o.hariPlafon))} hari</b>, karena biaya ditambah denda tidak boleh melebihi 100% nilai pinjaman. Artinya, utang ${rp(o.P)} paling banyak menjadi <b>${rp(o.P + o.P * ATURAN.plafonTotal)}</b> termasuk pokok. Lewat dari itu, tagihan yang terus membengkak adalah tanda pelanggaran.`}</div>
      <label class="field"><span>Denda per hari di perjanjian Anda <em>opsional</em></span>
        <div class="money"><input id="denda-in" inputmode="decimal" data-plain value="${esc(dendaInput)}" placeholder="${nf(3).format(o.bat.persen)}"><i>% per hari</i></div>
        <small>Kosongkan untuk memakai batas maksimum OJK.</small></label>
      ${o.dendaMelebihi ? `<div class="err" style="margin-top:10px">Denda di perjanjian Anda melebihi batas OJK ${pct(o.bat.persen, 3)} per hari.</div>` : ''}
      <p class="src"><b>Dasar:</b> ${ATURAN.sumber.denda} (batas denda) dan ${ATURAN.sumber.plafon} (plafon 100%).</p>
    </div>`;

  const potonganInsight = o.potongan > 0
    ? `<br><br>Ada potongan ${rp(o.potongan)} saat dana cair. Kalau dihitung dari uang yang benar-benar masuk ke rekening Anda, biayanya <b>${pctR(o.rRiil)} per hari</b>, bukan ${pctR(o.r)}. Potongan di depan membuat pinjaman terasa lebih murah dari aslinya.`
    : '';

  box.innerHTML = `
    <div class="verdicts">
      ${vcard('Wajar?', o.wajar, wajarTxt[0], wajarTxt[1])}
      ${vcard('Mampu?', o.mampu, mampu[0], mampu[1])}
      ${vcard('Legal?', lg[0], lg[1], lg[2])}
    </div>
    <a class="howto" href="#metode">Bagaimana lampu ini dihitung?</a>
    ${o.info.map(t => `<div class="err" style="margin-top:12px;background:var(--warn-bg);border-color:#f5d78c;color:#5c4300">${t}</div>`).join('')}
    <div class="panel block">
      <h3>Harga sebenarnya</h3>
      <div class="bigstat"><b>${rp(o.per100rb)}</b><span>per hari untuk setiap Rp100.000 yang Anda terima</span></div>
      <div class="insight">Anggap saja seperti harga per gram di rak supermarket. Dengan satu ukuran ini, tawaran yang nominal dan tenornya berbeda bisa dibandingkan secara adil. Kalau dihitung setahun, biayanya setara <b>${pct(o.tahunan * 100, 0)}</b> (bunga sederhana).${potonganInsight}</div>
      <div class="meter" style="margin-top:26px"><div class="meter-track"><div class="meter-fill" style="width:${fillW}%;background:${fillCol}"></div><div class="meter-mark" style="left:${markL}%"><span>Batas OJK ${pct(o.bat.persen, 3)}</span></div></div>
        <div class="meter-legend"><span>0%</span><span>biaya ${pctR(o.r)} per hari (rumus OJK)</span></div></div>
      <dl class="kv">
        <dt>Nilai pinjaman di perjanjian</dt><dd>${rp(o.P)}</dd>
        <dt>Uang yang Anda terima</dt><dd>${rp(o.D)}</dd>
        <dt>Total yang harus dibayar kembali</dt><dd>${rp(o.B)}</dd>
        <dt>Tenor</dt><dd>${nf(0).format(o.T)} hari${o.T >= 30 ? `<small>${nf(o.T % 30 ? 1 : 0).format(o.T / 30)} bulan × 30 hari</small>` : ''}</dd>
        <dt>Biaya pinjaman (manfaat ekonomi)</dt><dd>${rp(o.ME)}<small>${pct(o.rasioBiaya * 100)} dari nilai pinjaman</small></dd>
        <dt>Biaya maksimum yang diizinkan OJK</dt><dd>${rp(o.meMaks)}<small>${pct(o.bat.persen, 3)} × ${rp(o.P)} × ${nf(0).format(o.T)} hari</small></dd>
        <div class="total" style="display:contents"><dt>${o.ME > o.meMaks ? 'Kelebihan dari batas' : 'Ruang di bawah batas'}</dt><dd style="color:${o.ME > o.meMaks ? 'var(--crit)' : 'inherit'}">${rp(Math.abs(o.meMaks - o.ME))}</dd></div>
      </dl>
      <p class="src"><b>Rumus OJK:</b> biaya per hari = manfaat ekonomi ÷ (nilai pinjaman di perjanjian × tenor dalam hari). Manfaat ekonomi mencakup bunga, biaya admin atau fee platform, dan biaya lain, tidak termasuk denda, biaya tanda tangan elektronik, dan pajak. <b>Dasar:</b> ${ATURAN.sumber.me} dan ${ATURAN.sumber.batas} ${o.bat.dasar}.</p>
    </div>
    ${mampuBlock}
    ${telatBlock}
`;
}

// Interaksi di area hasil (delegasi)
$('#hasil').addEventListener('input', e => {
  if (e.target.id === 'hari') {
    hariTelat = +e.target.value; renderKalk();
    const s = $('#hari'); if (s) s.focus();
  } else if (e.target.id === 'denda-in') {
    dendaInput = e.target.value.replace(/[^\d.,]/g, '');
    clearTimeout(renderKalk._t);
    renderKalk._t = setTimeout(() => { renderKalk(); const d = $('#denda-in'); if (d) { d.focus(); d.setSelectionRange(d.value.length, d.value.length); } }, 450);
  }
});
// Langkah 4: ciri penyelenggara
const CIRI = [
  ['izin', 'Nama aplikasi atau perusahaannya tercantum di daftar pindar berizin OJK?', 'Cara cek: cocokkan nama aplikasi dan perusahaannya dengan daftar penyelenggara pindar berizin yang dipublikasikan OJK.'],
  ['akses', 'Aplikasi hanya meminta akses kamera, lokasi, dan mikrofon?', `Pindar berizin hanya boleh mengakses tiga hal itu (${ATURAN.sumber.akses}). Kalau aplikasi meminta akses kontak atau galeri, itu tanda bahaya.`],
  ['tawaran', 'Anda sendiri yang mencari pinjaman ini, bukan ditawari lewat SMS atau WhatsApp dari nomor tak dikenal?', `Penyelenggara dilarang menawarkan layanan lewat sarana komunikasi pribadi tanpa persetujuan (${ATURAN.sumber.tawaran}).`],
  ['jelas', 'Biaya, denda, dan tenor dijelaskan secara tertulis sebelum Anda setuju?', 'Pindar berizin wajib meminta Anda membaca dan menyetujui pernyataan pemahaman risiko sebelum dana cair (SEOJK 19/2025, lampiran).']
];
function renderLegal() {
  $('#legal-list').innerHTML = CIRI.map(([k, q, s]) => {
    const v = legal[k], cls = v === true ? 'ya' : v === false ? 'tidak' : v === '?' ? 'tahu' : '';
    return `<li class="${cls}"><div>${q}<small>${s}</small></div>
      <div class="yn" data-k="${k}" role="group" aria-label="Jawaban">
        <button type="button" class="ya" data-v="ya" aria-pressed="${v === true}">Ya</button>
        <button type="button" class="tidak" data-v="tidak" aria-pressed="${v === false}">Tidak</button>
        <button type="button" class="tahu" data-v="tahu" aria-pressed="${v === '?'}">Tidak tahu</button></div></li>`;
  }).join('');
}
$('#legal-list').addEventListener('click', e => {
  const b = e.target.closest('.yn button'); if (!b) return;
  const k = b.parentElement.dataset.k, v = { ya: true, tidak: false, tahu: '?' }[b.dataset.v];
  legal[k] = legal[k] === v ? null : v;
  renderLegal(); renderKalk();
});
renderLegal();

form.addEventListener('input', () => { aturMode(); renderKalk(); });
form.addEventListener('change', () => { aturMode(); renderKalk(); });
form.addEventListener('submit', e => e.preventDefault());

const CONTOH = {
  sms: { jenis: 'konsumtif', mode: 'total', P: 2000000, B: 2200000, tenor: 14, satuan: 'hari', potongan: 200000, caraBayar: 'akhir', penghasilan: 3500000, cicilanLain: 600000 },
  cicil: { jenis: 'konsumtif', mode: 'cicilan', P: 5000000, c: 1050000, n: 6, frek: 30, potongan: 0, penghasilan: 4500000, cicilanLain: 500000 },
  ojk1: { jenis: 'produktif', mode: 'rincian', P: 50000000, bunga: 1000000, admin: 200000, lain: 50000, adminDipotong: false, tenor: 5, satuan: 'bulan', caraBayar: 'bulanan', penghasilan: '', cicilanLain: '' },
  ojk2: { jenis: 'konsumtif', mode: 'rincian', P: 150000000, bunga: 2000000, admin: 300000, lain: 50000, adminDipotong: false, tenor: 7, satuan: 'bulan', caraBayar: 'bulanan', penghasilan: '', cicilanLain: '' }
};
$$('[data-contoh]').forEach(btn => btn.addEventListener('click', () => {
  const c = CONTOH[btn.dataset.contoh];
  form.reset(); legal = { izin: null, akses: null, tawaran: null, jelas: null }; dendaInput = ''; hariTelat = 30; renderLegal();
  form.querySelector(`[name=jenis][value=${c.jenis}]`).checked = true;
  form.querySelector(`[name=mode][value=${c.mode}]`).checked = true;
  for (const [k, v] of Object.entries(c)) {
    const el = form.elements[k];
    if (!el || k === 'jenis' || k === 'mode') continue;
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.tagName === 'SELECT') el.value = String(v);
    else el.value = v === '' ? '' : (['n', 'tenor'].includes(k) ? String(v) : nf(0).format(v));
  }
  aturMode(); renderKalk();
  if (window.innerWidth < 920) $('#hasil').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

/* =========================================================
 * 4. BANDINGKAN TAWARAN
 * ========================================================= */
const bandRows = $('#band-rows');
let bandN = 0;
function tambahBaris(v = {}) {
  if (bandRows.children.length >= 4) return;
  bandN++;
  const d = document.createElement('div');
  d.className = 'band-row';
  d.innerHTML = `
    <header><input name="nama" value="${esc(v.nama || 'Tawaran ' + String.fromCharCode(64 + bandN))}" aria-label="Nama tawaran"><button type="button" class="btn-x" aria-label="Hapus tawaran">×</button></header>
    <div class="band-grid">
      <label class="field"><span>Nilai pinjaman</span><div class="money"><i>Rp</i><input name="P" inputmode="numeric" value="${v.P ? nf(0).format(v.P) : ''}"></div></label>
      <label class="field"><span>Potongan di awal</span><div class="money"><i>Rp</i><input name="potongan" inputmode="numeric" value="${v.potongan ? nf(0).format(v.potongan) : ''}" placeholder="0"></div></label>
      <label class="field"><span>Total bayar</span><div class="money"><i>Rp</i><input name="B" inputmode="numeric" value="${v.B ? nf(0).format(v.B) : ''}"></div></label>
      <label class="field"><span>Tenor</span><div class="money"><input name="tenor" inputmode="numeric" value="${v.tenor || ''}"></div></label>
      <label class="field"><span>Satuan</span><select name="satuan"><option value="hari">hari</option><option value="bulan"${v.satuan === 'bulan' ? ' selected' : ''}>bulan</option></select></label>
    </div>`;
  bandRows.appendChild(d);
  $('#band-add').hidden = bandRows.children.length >= 4;
}
bindMoney(bandRows);
bandRows.addEventListener('click', e => {
  if (e.target.closest('.btn-x') && bandRows.children.length > 2) { e.target.closest('.band-row').remove(); $('#band-add').hidden = false; renderBand(); }
});
bandRows.addEventListener('input', renderBand);
bandRows.addEventListener('change', renderBand);
$$('[name=bjenis]').forEach(r => r.addEventListener('change', renderBand));
$('#band-add').addEventListener('click', () => { tambahBaris(); renderBand(); });

function renderBand() {
  const jenis = $('[name=bjenis]:checked').value;
  const rows = $$('.band-row', bandRows).map(el => {
    const g = n => el.querySelector(`[name=${n}]`);
    const inp = { jenis, mode: 'total', P: digits(g('P').value), potongan: digits(g('potongan').value), B: digits(g('B').value), tenor: digits(g('tenor').value), satuan: g('satuan').value };
    return { nama: g('nama').value || 'Tawaran', o: hitung(inp) };
  });
  const ok = rows.filter(r => !r.o.errors.length);
  const out = $('#band-hasil');
  if (ok.length < 1) { out.innerHTML = '<div class="panel empty"><p>Lengkapi minimal satu tawaran: nilai pinjaman, total bayar, dan tenor.</p></div>'; return; }
  const best = ok.reduce((a, b) => (b.o.per100rb < a.o.per100rb ? b : a));
  const maxV = Math.max(...ok.map(r => r.o.per100rb));
  const lbl = { good: 'Dalam batas', crit: 'Melebihi batas' };
  const col = { good: 'var(--good)', crit: 'var(--crit)' };
  const sameME = ok.length > 1 && ok.every(r => Math.abs(r.o.ME - ok[0].o.ME) < 1);
  out.innerHTML = `
  <div class="panel block">
    <h3>Hasil perbandingan</h3>
    <div class="scroll-x"><table class="cmp">
      <thead><tr><th>Tawaran</th><th>Per Rp100 rb/hari</th><th>Batas OJK</th><th>Uang diterima</th><th>Total bayar</th><th>Biaya</th></tr></thead>
      <tbody>${rows.map(r => r.o.errors.length
        ? `<tr><td>${esc(r.nama)}</td><td colspan="5" style="text-align:left;color:var(--ink-3)">${esc(r.o.errors[0])}</td></tr>`
        : `<tr class="${r === best && ok.length > 1 ? 'best' : ''}"><td><b>${esc(r.nama)}</b>${r === best && ok.length > 1 ? '<br><span class="tag" style="background:#fff">termurah</span>' : ''}</td>
            <td><b>${rp(r.o.per100rb)}</b></td>
            <td><span class="pill"><i style="background:${col[r.o.wajar]}"></i>${lbl[r.o.wajar]}</span><br><small style="color:var(--ink-3)">${pctR(r.o.r)} / ${pct(r.o.bat.persen, 3)}</small></td>
            <td>${rp(r.o.D)}</td><td>${rp(r.o.B)}<br><small style="color:var(--ink-3)">${nf(0).format(r.o.T)} hari</small></td><td>${rp(r.o.ME)}</td></tr>`).join('')}
      </tbody></table></div>
    <div class="bar100" aria-hidden="true">${ok.map(r => `<div class="r"><span>${esc(r.nama)}</span><div class="t"><span style="width:${r.o.per100rb / maxV * 100}%;background:${r === best ? 'var(--s1)' : '#b9b4a7'}"></span></div><b>${rp(r.o.per100rb)}</b></div>`).join('')}</div>
    ${ok.length > 1 ? `<div class="insight">${sameME
      ? `Total biayanya sama-sama ${rp(ok[0].o.ME)}, tetapi harganya berbeda. Yang menentukan adalah <b>berapa lama</b> dan <b>berapa banyak uang</b> yang benar-benar Anda pakai. <b>${esc(best.nama)}</b> adalah yang termurah.`
      : `<b>${esc(best.nama)}</b> paling murah per rupiah yang Anda terima. Jangan hanya melihat besar cicilan: cicilan kecil dengan tenor panjang atau potongan besar di awal bisa lebih mahal.`}</div>` : ''}
  </div>`;
}
tambahBaris({ nama: 'Aplikasi A', P: 3000000, potongan: 150000, B: 3450000, tenor: 60, satuan: 'hari' });
tambahBaris({ nama: 'Aplikasi B', P: 3000000, potongan: 0, B: 3600000, tenor: 3, satuan: 'bulan' });
renderBand();

/* =========================================================
 * 5. KESEHATAN PINDAR
 * ========================================================= */
const KEPULAUAN = {
  Sumatera: ['Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Kepulauan Bangka Belitung', 'Jambi', 'Sumatera Selatan', 'Bengkulu', 'Lampung'],
  Jawa: ['Banten', 'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur'],
  Kalimantan: ['Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara'],
  Sulawesi: ['Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara'],
  'Bali dan Nusa Tenggara': ['Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur'],
  'Maluku dan Papua': ['Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Tengah', 'Papua Pegunungan', 'Papua Selatan']
};
const pulauDari = p => Object.keys(KEPULAUAN).find(k => KEPULAUAN[k].includes(p));
let DATA = null, BULANS = [], provAktif = 'Kalimantan Timur';
try { const s = localStorage.getItem('cekdulu-prov'); if (s) provAktif = s; } catch (_) {}

async function muatData() {
  if (DATA) return DATA;
  const res = await fetch('data/pindar-prov.csv', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Gagal memuat data');
  const txt = await res.text();
  const map = {};
  const set = new Set();
  txt.trim().split(/\r?\n/).slice(1).forEach(line => {
    const [prov, ym, rek, out, twp] = line.split(',');
    (map[prov] = map[prov] || {})[ym] = { rek: +rek, out: +out, twp: +twp };
    set.add(ym);
  });
  BULANS = [...set].sort();
  DATA = map;
  const sel = $('#prov');
  sel.innerHTML = Object.keys(map).filter(p => p !== 'Indonesia').sort((a, b) => a.localeCompare(b, 'id'))
    .map(p => `<option${p === provAktif ? ' selected' : ''}>${p}</option>`).join('');
  if (!map[provAktif]) { provAktif = 'Kalimantan Timur'; sel.value = provAktif; }
  sel.addEventListener('change', () => { provAktif = sel.value; try { localStorage.setItem('cekdulu-prov', provAktif); } catch (_) {} renderKesehatan(); });
  return map;
}

function ringkas(p) {
  const d = DATA[p], last = BULANS[BULANS.length - 1];
  const [ly, lm] = last.split('-');
  const prev = `${+ly - 1}-${lm}`, prev2 = `${+ly - 2}-${lm}`;
  const L = d[last], Y = d[prev], Z = d[prev2];
  const avg = x => x ? x.out * 1e9 / x.rek : null;
  return {
    p, last, prev, prev2, L, Y, Z,
    tumbuh: Y ? (L.out / Y.out - 1) * 100 : null,
    tumbuhRek: Y ? (L.rek / Y.rek - 1) * 100 : null,
    kali2: Z ? L.out / Z.out : null,
    avg: avg(L), avgY: avg(Y),
    twpY: Y ? Y.twp : null
  };
}

const LEVEL = [
  { cls: 'good', nama: 'Sehat', icon: 'good' },
  { cls: 'warn', nama: 'Waspada dini', icon: 'warn' },
  { cls: 'serious', nama: 'Waspada', icon: 'serious' },
  { cls: 'crit', nama: 'Rawan', icon: 'crit' }
];
const Q_NAMA = ['Terjaga', 'Perlu perhatian', 'Di atas 5%'];
const G_NAMA = ['Wajar', 'Cepat', 'Sangat cepat'];

async function renderKesehatan() {
  const body = $('#kes-body');
  try { await muatData(); } catch (e) {
    body.innerHTML = '<div class="panel"><div class="err">Data belum bisa dimuat. Jika Anda membuka file ini langsung dari komputer, jalankan lewat server web atau GitHub Pages.</div></div>';
    return;
  }
  const s = ringkas(provAktif), n = ringkas('Indonesia');
  const provs = Object.keys(DATA).filter(p => p !== 'Indonesia');
  const all = provs.map(ringkas);
  const tumbuhAll = all.map(x => x.tumbuh);
  const med = kuartil(tumbuhAll, 0.5), q3 = kuartil(tumbuhAll, 0.75);
  const st = statusKesehatan(s.L.twp, n.L.twp, s.tumbuh, med, q3);
  const jw = KEPULAUAN.Jawa.map(ringkas), jOut = jw.reduce((t, x) => t + x.L.out, 0), jY = jw.reduce((t, x) => t + (x.Y ? x.Y.out : 0), 0);
  const jawa = { porsi: jOut / n.L.out * 100, tumbuh: (jOut / jY - 1) * 100 };
  const lv = LEVEL[st.lvl];
  $('#kes-nama-h').textContent = 'di ' + provAktif + '?';

  // Peringkat
  const rank = (key, desc = true) => 1 + all.filter(x => x[key] != null && (desc ? x[key] > s[key] : x[key] < s[key])).length;
  const rOut = 1 + all.filter(x => x.L.out > s.L.out).length;
  const rTwp = 1 + all.filter(x => x.L.twp > s.L.twp).length;
  const rTum = s.tumbuh != null ? rank('tumbuh') : null;
  const N = provs.length;

  // Teks "apa artinya bagi Anda"
  const P = provAktif, arti = [];
  const kalimatLaju = `dalam setahun utangnya naik ${pct(s.tumbuh)}, lebih cepat dari ${st.g === 2 ? 'tiga perempat' : 'separuh'} provinsi lain`;
  if (st.q === 0 && st.g === 0) arti.push(`Warga ${P} membayar pindar dengan lancar, dan utangnya tumbuh dengan kecepatan yang wajar dibanding provinsi lain.`);
  if (st.q === 0 && st.g > 0) arti.push(`Warga ${P} masih membayar pindar dengan lancar. Yang perlu diperhatikan adalah kecepatannya: ${kalimatLaju}.`, 'Pinjaman baru dihitung macet setelah menunggak 90 hari, jadi masalah biasanya baru kelihatan belakangan.');
  if (st.q === 1) arti.push(`Porsi pinjaman yang menunggak lebih dari 90 hari di ${P} lebih tinggi dari rata-rata nasional.${st.g > 0 ? ` Di saat yang sama, ${kalimatLaju}.` : ''}`);
  if (st.q === 2) arti.push(`Porsi pinjaman yang menunggak lebih dari 90 hari di ${P} sudah lewat 5%, angka yang menjadi batas maksimum bagi setiap penyelenggara.${st.g > 0 ? ` Di saat yang sama, ${kalimatLaju}.` : ''}`);
  arti.push(st.lvl === 0
    ? 'Meski begitu, daerah yang sehat tidak menjamin tawaran yang Anda terima juga sehat. Tetap cek sebelum menyetujui.'
    : 'Sebelum menambah pinjaman baru, pastikan semua cicilan Anda tidak lebih dari 30% penghasilan dan biayanya masih dalam batas OJK.');

  const arah = (v, baikTurun = true) => v == null ? '' : `<span class="${(v > 0) === baikTurun ? 'up' : 'down'}">${v > 0 ? '▲' : '▼'} ${pct(Math.abs(v))}</span>`;
  const twpDelta = s.twpY != null ? s.L.twp - s.twpY : null;

  // Sorotan
  const puncak = BULANS.reduce((a, ym) => (DATA[provAktif][ym] && (!a || DATA[provAktif][ym].twp > DATA[provAktif][a].twp) ? ym : a), null);
  const sorotan = [
    `Utang pindar di ${provAktif} mencapai <b>${rpM(s.L.out)}</b> per ${ymLabel(s.last, true)}, ${s.tumbuh != null ? `naik <b>${pct(s.tumbuh)}</b> dalam setahun. Secara nasional naiknya ${pct(n.tumbuh)}.` : 'data tahun sebelumnya belum tersedia.'}`,
    s.kali2 ? `Dalam dua tahun, utangnya menjadi <b>${nf(2).format(s.kali2)} kali lipat</b> (nasional ${nf(2).format(n.kali2)} kali).` : `Provinsi ini baru tercatat terpisah sejak pertengahan 2024, sehingga perbandingan dua tahun belum tersedia.`,
    `Dari setiap Rp100 utang pindar, sekitar <b>Rp${nf(2).format(s.L.twp)}</b> menunggak lebih dari 90 hari (TWP90 ${pct(s.L.twp, 2)}). Nasional: Rp${nf(2).format(n.L.twp)}.`,
    `Rata-rata utang per rekening aktif <b>${rpJt(s.avg)}</b>, ${s.avg > n.avg ? 'lebih tinggi' : 'lebih rendah'} dari rata-rata nasional ${rpJt(n.avg)}${s.avgY ? `, dan ${s.avg > s.avgY ? 'naik' : 'turun'} dari ${rpJt(s.avgY)} setahun sebelumnya` : ''}.`,
    puncak ? `TWP90 tertinggi dalam ${BULANS.length} bulan terakhir: ${pct(DATA[provAktif][puncak].twp, 2)} pada ${ymLabel(puncak, true)}.` : ''
  ].filter(Boolean);

  const pulau = pulauDari(provAktif);
  body.innerHTML = `
    <div class="status ${lv.cls}">
      <div>
        <div class="lvl"><span style="color:${{ good: 'var(--good)', warn: '#c98500', serious: '#d2622f', crit: 'var(--crit)' }[lv.cls]}">${ICON[lv.icon]}</span>
          <div><small>Status ${esc(provAktif)}</small><strong>${lv.nama}</strong></div></div>
        <div class="dims">
          <div class="dim"><small>Kualitas</small><div class="dots">${[0, 1, 2].map(i => `<i class="${i <= st.q ? 'on' : ''}"></i>`).join('')}</div><b>${Q_NAMA[st.q]}</b><span>TWP90 ${pct(s.L.twp, 2)} vs nasional ${pct(n.L.twp, 2)}</span></div>
          <div class="dim"><small>Laju</small><div class="dots">${[0, 1, 2].map(i => `<i class="${i <= st.g ? 'on' : ''}"></i>`).join('')}</div><b>${G_NAMA[st.g]}</b><span>Naik ${s.tumbuh != null ? pct(s.tumbuh) : 'n/a'} setahun. Median provinsi ${pct(med)}, kuartil atas ${pct(q3)}</span></div>
        </div>
      </div>
      <div class="artinya">
        <h3>Apa artinya bagi Anda</h3>
        ${arti.map(t => `<p>${t}</p>`).join('')}
        <a class="cta" href="#kalkulator">Cek tawaran pinjaman Anda →</a>
      </div>
    </div>
    <p class="src" style="margin:10px 2px 0">Data per <b>${ymLabel(s.last, true)}</b>, Statistik LPBBTI OJK (termasuk syariah). Status dihitung otomatis oleh alat ini, bukan penilaian resmi OJK. <a href="#metode">Bagaimana status ini dihitung?</a></p>

    <div class="kpis">
      <div class="kpi"><small>Outstanding pindar</small><b>${rpM(s.L.out)}</b><span>${arah(s.tumbuh)} setahun · peringkat ${rOut} dari ${N}</span></div>
      <div class="kpi"><small>Rekening penerima aktif</small><b>${nf(0).format(s.L.rek)}</b><span>${arah(s.tumbuhRek)} setahun</span></div>
      <div class="kpi"><small>Rata-rata utang per rekening</small><b>${rpJt(s.avg)}</b><span>nasional ${rpJt(n.avg)}</span></div>
      <div class="kpi"><small>TWP90 (macet &gt;90 hari)</small><b>${pct(s.L.twp, 2)}</b><span>${twpDelta != null ? `<span class="${twpDelta > 0 ? 'up' : 'down'}">${twpDelta > 0 ? '▲' : '▼'} ${nf(2).format(Math.abs(twpDelta))} poin</span> setahun · ` : ''}ke-${rTwp} tertinggi dari ${N}</span></div>
    </div>

    <div class="panel sorotan block">
      <h3>Sorotan</h3>
      <ul>${sorotan.map(t => `<li>${t}</li>`).join('')}</ul>
      ${rTum ? `<p class="src">Pertumbuhan outstanding ${provAktif} tercepat ke-${rTum} dari ${N} provinsi. ${n.tumbuh < med ? ` Pertumbuhan nasional (${pct(n.tumbuh)}) lebih rendah dari median provinsi (${pct(med)}) karena Jawa, yang memegang ${pct(jawa.porsi, 0)} outstanding nasional, hanya tumbuh ${pct(jawa.tumbuh)}.` : ''}</p>` : ''}
    </div>

    <div class="charts">
      <div class="panel chart-card wide"><h3>Outstanding pindar ${esc(provAktif)}</h3><p class="sub">Sisa pokok pinjaman yang belum dibayar, per akhir bulan</p><div class="chart" id="c-out"></div></div>
      <div class="panel chart-card"><h3>TWP90: porsi pinjaman macet &gt;90 hari</h3><p class="sub">Makin rendah makin baik</p>
        <div class="legend"><span><i style="background:var(--s1)"></i>${esc(provAktif)}</span><span><i style="background:var(--s2)"></i>Nasional</span><span><i class="dash"></i>Batas 5%</span></div><div class="chart" id="c-twp"></div></div>
      <div class="panel chart-card"><h3>Rata-rata utang per rekening</h3><p class="sub">Outstanding dibagi rekening aktif</p>
        <div class="legend"><span><i style="background:var(--s1)"></i>${esc(provAktif)}</span><span><i style="background:var(--s2)"></i>Nasional</span></div><div class="chart" id="c-avg"></div></div>
      <div class="panel chart-card"><h3>TWP90 se-${esc(pulau)}</h3><p class="sub">${ymLabel(s.last, true)}; garis putus-putus = nasional</p><div class="chart" id="c-p-twp"></div></div>
      <div class="panel chart-card"><h3>Pertumbuhan outstanding se-${esc(pulau)}</h3><p class="sub">Setahun terakhir; garis putus-putus = nasional</p><div class="chart" id="c-p-tum"></div></div>
    </div>

    <details class="tabel panel block"><summary>Lihat tabel data ${esc(provAktif)} dan nasional</summary>
      <div class="scroll-x"><table class="datatable"><thead><tr><th>Bulan</th><th>Rekening aktif</th><th>Outstanding (Rp M)</th><th>TWP90</th><th>Nasional: outstanding</th><th>Nasional: TWP90</th></tr></thead>
      <tbody>${BULANS.slice().reverse().map(ym => { const a = DATA[provAktif][ym], b = DATA.Indonesia[ym]; return `<tr><td>${ymLabel(ym, true)}</td><td>${a ? nf(0).format(a.rek) : 'n/a'}</td><td>${a ? nf(1).format(a.out) : 'n/a'}</td><td>${a ? pct(a.twp, 2) : 'n/a'}</td><td>${nf(1).format(b.out)}</td><td>${pct(b.twp, 2)}</td></tr>`; }).join('')}</tbody></table></div>
    </details>`;

  const labels = BULANS.map(ym => ymLabel(ym));
  const ser = (p, f) => BULANS.map(ym => DATA[p][ym] ? f(DATA[p][ym]) : null);
  lineChart($('#c-out'), { labels, area: true, fmt: v => rpM(v), series: [{ name: provAktif, color: 'var(--s1)', values: ser(provAktif, x => x.out) }] });
  lineChart($('#c-twp'), { labels, fmt: v => pct(v, 2), ref: { value: 5, label: 'Batas 5%' }, series: [{ name: provAktif, color: 'var(--s1)', values: ser(provAktif, x => x.twp) }, { name: 'Nasional', color: 'var(--s2)', values: ser('Indonesia', x => x.twp) }] });
  lineChart($('#c-avg'), { labels, fmt: v => rpJt(v), series: [{ name: provAktif, color: 'var(--s1)', values: ser(provAktif, x => x.out * 1e9 / x.rek) }, { name: 'Nasional', color: 'var(--s2)', values: ser('Indonesia', x => x.out * 1e9 / x.rek) }] });
  const peers = KEPULAUAN[pulau].filter(p => DATA[p]).map(ringkas);
  barChart($('#c-p-twp'), { items: peers.map(x => ({ name: x.p, value: x.L.twp, hl: x.p === provAktif })).sort((a, b) => b.value - a.value), fmt: v => pct(v, 2), ref: { value: n.L.twp, label: 'Nasional ' + pct(n.L.twp, 2) } });
  barChart($('#c-p-tum'), { items: peers.filter(x => x.tumbuh != null).map(x => ({ name: x.p, value: x.tumbuh, hl: x.p === provAktif })).sort((a, b) => b.value - a.value), fmt: v => pct(v), ref: { value: n.tumbuh, label: 'Nasional ' + pct(n.tumbuh) } });
}

/* ---------- Grafik SVG ringan (tanpa pustaka) ---------- */
const tip = $('#tip');
function showTip(html, x, y) {
  tip.innerHTML = html; tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let lx = x + 14, ly = y - h - 12;
  if (lx + w > window.innerWidth - 8) lx = x - w - 14;
  if (ly < 8) ly = y + 16;
  tip.style.left = lx + 'px'; tip.style.top = ly + 'px';
}
const hideTip = () => { tip.hidden = true; };
function niceTicks(min, max, n = 4) {
  const span = max - min || Math.abs(max) || 1;
  const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const t = []; for (let v = lo; v <= hi + step / 2; v += step) t.push(+v.toFixed(10));
  return t;
}
const charts = [];
function lineChart(el, cfg) {
  const draw = () => {
    const W = Math.max(280, el.clientWidth), H = cfg.area ? 230 : 210;
    const m = { l: 56, r: 14, t: 12, b: 26 };
    const all = cfg.series.flatMap(s => s.values).filter(v => v != null).concat(cfg.ref ? [cfg.ref.value] : []);
    const ticks = niceTicks(cfg.area ? 0 : Math.min(0, ...all), Math.max(...all));
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const X = i => m.l + i * (W - m.l - m.r) / (cfg.labels.length - 1);
    const Y = v => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
    const path = vals => { let d = '', pen = false; vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; }); return d; };
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.series.map(x => x.name).join(' dan '))}">`;
    ticks.forEach(t => { s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--grid)"/><text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${esc(cfg.fmt(t))}</text>`; });
    cfg.labels.forEach((l, i) => { if (i % 6 === 0 || i === cfg.labels.length - 1 && cfg.labels.length % 6 !== 1) s += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${l}</text>`; });
    if (cfg.ref) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(cfg.ref.value)}" y2="${Y(cfg.ref.value)}" stroke="var(--ink-3)" stroke-dasharray="4 3"/><text x="${W - m.r}" y="${Y(cfg.ref.value) - 5}" text-anchor="end">${esc(cfg.ref.label)}</text>`;
    cfg.series.forEach(se => {
      if (cfg.area) { const first = se.values.findIndex(v => v != null); s += `<path d="${path(se.values)} L${X(se.values.length - 1)} ${Y(y0)} L${X(first)} ${Y(y0)}Z" fill="${se.color}" opacity=".1"/>`; }
      s += `<path d="${path(se.values)}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      const li = se.values.length - 1; if (se.values[li] != null) s += `<circle cx="${X(li)}" cy="${Y(se.values[li])}" r="4" fill="${se.color}" stroke="var(--card)" stroke-width="2"/>`;
    });
    s += `<g class="hov" style="display:none"><line class="hx" y1="${m.t}" y2="${H - m.b}" stroke="var(--ink-3)"/>${cfg.series.map(se => `<circle r="4.5" fill="${se.color}" stroke="var(--card)" stroke-width="2"/>`).join('')}</g>`;
    s += `<rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent"/></svg>`;
    el.innerHTML = s;
    const svg = el.querySelector('svg'), hov = svg.querySelector('.hov'), rect = svg.querySelector('rect:last-of-type');
    const move = ev => {
      const b = svg.getBoundingClientRect(), px = (ev.clientX - b.left) * W / b.width;
      const i = Math.max(0, Math.min(cfg.labels.length - 1, Math.round((px - m.l) / ((W - m.l - m.r) / (cfg.labels.length - 1)))));
      hov.style.display = ''; hov.querySelector('.hx').setAttribute('x1', X(i)); hov.querySelector('.hx').setAttribute('x2', X(i));
      [...hov.querySelectorAll('circle')].forEach((c, k) => { const v = cfg.series[k].values[i]; c.style.display = v == null ? 'none' : ''; if (v != null) { c.setAttribute('cx', X(i)); c.setAttribute('cy', Y(v)); } });
      showTip(`<b>${ymLabel(BULANS[i], true)}</b><br>${cfg.series.map(se => `<i style="background:${se.color}"></i>${esc(se.name)}: ${se.values[i] == null ? 'n/a' : esc(cfg.fmt(se.values[i]))}`).join('<br>')}`, ev.clientX, ev.clientY);
    };
    rect.addEventListener('pointermove', move);
    rect.addEventListener('pointerdown', move);
    rect.addEventListener('pointerleave', () => { hov.style.display = 'none'; hideTip(); });
  };
  draw(); charts.push({ el, draw });
}
function barChart(el, cfg) {
  const draw = () => {
    const W = Math.max(280, el.clientWidth), rowH = 30, m = { l: 128, r: 64, t: 18, b: 6 };
    const H = m.t + cfg.items.length * rowH + m.b;
    const vals = cfg.items.map(i => i.value).concat(cfg.ref ? [cfg.ref.value] : []);
    const lo = Math.min(0, ...vals), hi = Math.max(...vals) * 1.02;
    const X = v => m.l + (v - lo) / (hi - lo) * (W - m.l - m.r);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Perbandingan provinsi">`;
    cfg.items.forEach((it, k) => {
      const y = m.t + k * rowH + 6, h = rowH - 12, x0 = X(Math.min(0, it.value)), x1 = X(Math.max(0, it.value));
      s += `<g class="bar" data-k="${k}"><rect x="0" y="${y - 6}" width="${W}" height="${rowH}" fill="transparent"/>`;
      s += `<text x="${m.l - 8}" y="${y + h / 2 + 4}" text-anchor="end" class="${it.hl ? 'lbl' : ''}">${esc(it.name.replace('Kalimantan', 'Kal.').replace('Sulawesi', 'Sul.').replace('Sumatera', 'Sum.').replace('Kepulauan', 'Kep.').replace('Nusa Tenggara', 'NT'))}</text>`;
      s += `<rect x="${x0}" y="${y}" width="${Math.max(1, x1 - x0)}" height="${h}" rx="4" fill="${it.hl ? 'var(--s1)' : '#c9c3b5'}"/>`;
      s += `<text x="${x1 + 6}" y="${y + h / 2 + 4}" class="${it.hl ? 'lbl' : ''}">${esc(cfg.fmt(it.value))}</text></g>`;
    });
    if (cfg.ref) s += `<line x1="${X(cfg.ref.value)}" x2="${X(cfg.ref.value)}" y1="${m.t - 4}" y2="${H - m.b}" stroke="var(--s2)" stroke-width="2" stroke-dasharray="4 3"/><text x="${X(cfg.ref.value)}" y="${m.t - 7}" text-anchor="middle" style="fill:var(--ink-2)">${esc(cfg.ref.label)}</text>`;
    s += '</svg>';
    el.innerHTML = s;
    el.querySelectorAll('.bar').forEach(g => {
      const it = cfg.items[+g.dataset.k];
      const f = ev => showTip(`<b>${esc(it.name)}</b><br>${esc(cfg.fmt(it.value))}${cfg.ref ? `<br>${esc(cfg.ref.label)}` : ''}`, ev.clientX, ev.clientY);
      g.addEventListener('pointermove', f); g.addEventListener('pointerdown', f); g.addEventListener('pointerleave', hideTip);
    });
  };
  draw(); charts.push({ el, draw });
}
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { charts.splice(0).forEach(c => { if (document.body.contains(c.el)) { c.draw(); charts.push(c); } }); }, 150); });
document.addEventListener('scroll', hideTip, { passive: true });

/* =========================================================
 * 6. METODE
 * ========================================================= */
$('#metode-body').innerHTML = `
<div class="mgrid">
  <div class="panel">
    <h2>Tabel aturan yang dipakai</h2>
    <div class="scroll-x"><table class="mtable">
      <thead><tr><th>Aturan</th><th>Isi</th><th>Sumber</th></tr></thead>
      <tbody>
        <tr><td><b>Batas biaya, konsumtif</b></td><td>0,3% per hari (tenor sampai 6 bulan); 0,2% per hari (di atas 6 bulan), dari nilai pinjaman di perjanjian</td><td>SEOJK 19/2025 XIV.3.b</td></tr>
        <tr><td><b>Batas biaya, produktif sampai Rp50 juta</b></td><td>0,275% per hari (sampai 6 bulan); 0,1% per hari (di atas 6 bulan)</td><td>SEOJK 19/2025 XIV.3.a.1</td></tr>
        <tr><td><b>Batas biaya, produktif di atas Rp50 juta</b></td><td>0,1% per hari, semua tenor</td><td>SEOJK 19/2025 XIV.3.a.2</td></tr>
        <tr><td><b>Komponen biaya (manfaat ekonomi)</b></td><td>Bunga/margin/bagi hasil, biaya admin/komisi/fee platform/ujrah, dan biaya lain. Tidak termasuk denda, biaya tanda tangan elektronik bersertifikat, dan pajak</td><td>SEOJK 19/2025 XIV.2</td></tr>
        <tr><td><b>Batas denda keterlambatan</b></td><td>Sama dengan batas biaya per hari</td><td>SEOJK 19/2025 XIV.4</td></tr>
        <tr><td><b>Plafon total</b></td><td>Biaya ditambah denda paling banyak 100% dari nilai pinjaman di perjanjian</td><td>SEOJK 19/2025 XIV.5</td></tr>
        <tr><td><b>Kemampuan bayar (konsumtif)</b></td><td>Pembayaran pokok dan biaya ke seluruh kreditur paling tinggi 40% penghasilan (2025) dan 30% (sejak 2026)</td><td>SEOJK 19/2025 XIII.2</td></tr>
        <tr><td><b>Akses gawai</b></td><td>Penyelenggara hanya dapat mengakses kamera, lokasi, dan mikrofon</td><td>SEOJK 19/2025 VII.1</td></tr>
        <tr><td><b>Penawaran</b></td><td>Dilarang menawarkan layanan lewat sarana komunikasi pribadi tanpa persetujuan</td><td>POJK 40/2024 Ps. 158 huruf k</td></tr>
        <tr><td><b>Batas pendanaan per penerima</b></td><td>Rp2 miliar; produktif dapat hingga Rp5 miliar dengan syarat</td><td>POJK 40/2024 Ps. 137</td></tr>
        <tr><td><b>TWP90</b></td><td>Outstanding wanprestasi di atas 90 hari dibagi total outstanding; batas penyelenggara 5%</td><td>POJK 40/2024 Ps. 172</td></tr>
      </tbody></table></div>
    <p class="src">SEOJK 19/SEOJK.06/2025 ditetapkan dan berlaku 31 Juli 2025. OJK dapat mengevaluasi batas ini secara berkala (XIV.7).</p>
  </div>

  <div class="panel">
    <h2>Rumus kalkulator</h2>
    <p>Notasi: P = nilai pinjaman di perjanjian, D = uang yang diterima (P dikurangi potongan), B = total yang dibayar kembali, T = tenor dalam hari (bulan × 30, sesuai contoh hitungan SEOJK).</p>
    <code class="formula">Biaya (manfaat ekonomi)  ME = B − D
   atau, jika rincian diisi: bunga + admin + biaya lain

Lampu Wajar             r = ME ÷ (P × T)
                        hijau: r ≤ batas OJK · merah: r > batas OJK

Harga sebenarnya        ME ÷ (D × T) × Rp100.000   (per hari)
                        setara tahunan = ME ÷ (D × T) × 365

Lampu Mampu             (cicilan per bulan pinjaman ini + cicilan lain) ÷ penghasilan
                        hijau: ≤ 30% · merah: > 30%

Lampu Legal             merah: biaya melebihi batas, atau ada ciri yang tidak terpenuhi
                        hijau: biaya dalam batas dan keempat ciri terpenuhi

Simulasi terlambat      denda per hari = batas (atau tarif di perjanjian) × P
                        denda maksimum = P × 100% − ME</code>
    <p><b>Prinsip warna.</b> Lampu hijau dan merah hanya dinyalakan oleh aturan tertulis, sehingga setiap putusan bisa ditelusuri ke satu pasal. Lampu kuning berarti belum bisa dinilai, misalnya penghasilan belum diisi atau ada ciri penyelenggara yang belum Anda ketahui.</p>
    <p>Rumus ini diuji dengan dua contoh resmi di SEOJK 19/2025. Produktif Rp50 juta, 150 hari, biaya Rp1.250.000 menghasilkan 0,0167% per hari (ditulis 0,017% di SEOJK). Konsumtif Rp150 juta, 210 hari, biaya Rp2.350.000 menghasilkan 0,0075% per hari (ditulis 0,007%). Keduanya bisa dicoba lewat tombol contoh.</p>
  </div>

  <div class="panel">
    <h2>Status kesehatan pindar</h2>
    <p>Belum ada aturan yang menetapkan kapan sebuah daerah dianggap sehat. Karena itu, status di sini memakai dua pembanding: batas dalam aturan jika ada, dan sebaran 38 provinsi jika tidak ada.</p>
    <div class="scroll-x"><table class="mtable">
      <thead><tr><th>Dimensi</th><th>Skor 0</th><th>Skor 1</th><th>Skor 2</th></tr></thead>
      <tbody>
        <tr><td><b>Kualitas</b> (TWP90)</td><td>Sama dengan atau di bawah nasional</td><td>Di atas nasional, sampai 5%</td><td>Di atas 5%</td></tr>
        <tr><td><b>Laju</b> (pertumbuhan outstanding setahun)</td><td>Sama dengan atau di bawah median 38 provinsi</td><td>Di atas median, sampai kuartil atas</td><td>Di atas kuartil atas (25% provinsi tercepat)</td></tr>
      </tbody></table></div>
    <p>Jumlah skor 0 = <b>Sehat</b>; 1 sampai 2 = <b>Waspada dini</b>; 3 = <b>Waspada</b>; 4 = <b>Rawan</b>. TWP90 di atas 5% minimal berstatus Waspada. Angka 5% adalah batas TWP90 untuk setiap penyelenggara (POJK 40/2024 Pasal 172), dipakai di sini sebagai acuan wilayah. Median dan kuartil dihitung ulang otomatis setiap kali data bulan baru ditambahkan, dengan metode kuartil eksklusif (sama dengan fungsi QUARTILE.EXC di Excel).</p>
    <p><b>Mengapa laju dibandingkan dengan median provinsi, bukan angka nasional?</b> Angka nasional didominasi Jawa yang memegang sekitar 70% outstanding dan tumbuh lebih lambat. Kalau dibandingkan dengan angka nasional, lebih dari separuh provinsi akan otomatis tampak tumbuh cepat.</p>
    <p><b>Mengapa dua dimensi?</b> TWP90 itu seperti kaca spion: menunjukkan apa yang sudah terjadi. Pinjaman baru masuk hitungan setelah menunggak lebih dari 90 hari. Laju pertumbuhan utang lebih mirip spidometer, yang memberi tahu seberapa kencang kita melaju sekarang. Daerah yang utangnya melesat bisa terlihat aman di kaca spion, padahal tekanannya baru terasa beberapa bulan kemudian.</p>
  </div>

  <div class="panel">
    <h2>Sumber data dan keterbatasan</h2>
    <ul>
      <li>Statistik Layanan Pendanaan Bersama Berbasis Teknologi Informasi (LPBBTI) OJK, edisi Desember 2024 dan Desember 2025, Tabel 9 (outstanding pinjaman dan TWP90 berdasarkan lokasi). Data termasuk syariah. Untuk bulan yang muncul di kedua edisi, dipakai angka edisi terbaru.</li>
      <li>Periode: Desember 2023 sampai Desember 2025 (25 bulan). Sejak periode Januari 2026, OJK memindahkan publikasi ke Portal Data Sektor Jasa Keuangan Terintegrasi; data akan ditambahkan ketika tersedia.</li>
      <li>Empat provinsi baru di Papua tercatat terpisah sejak Juli 2024.</li>
      <li>Alat ini tidak menyimpan daftar aplikasi berizin. Lampu "Legal?" menggabungkan uji batas biaya dengan jawaban Anda tentang ciri penyelenggara berizin.</li>
      <li>Ketentuan bahwa penerima tidak boleh didanai lebih dari 3 penyelenggara (SEOJK 19/2025 XI.3.k) tidak dijadikan putusan, karena pemberlakuannya sedang diberitakan berubah.</li>
    </ul>
  </div>
</div>`;

aturMode();
route();
}
