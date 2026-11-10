# Lampu Pindar

**Cek dulu sebelum pinjam.** Alat periksa independen untuk tawaran pinjaman daring (pindar) berbasis aturan OJK, ditambah panel Kesehatan Pindar per provinsi.

Situs: https://mrk29-feb.github.io/lampu-pindar/

Hak Cipta © 2026 **Muhammad Ramadhani Kesuma** (mrk29), Lab. Teknologi Keuangan, Fakultas Ekonomi dan Bisnis, Universitas Mulawarman, Samarinda. Build `mrk29-v1.0`.

## Fitur

1. **Cek Tawaran**: tiga lampu (Wajar? Mampu? Legal?), harga per Rp100 ribu per hari, simulasi keterlambatan dengan plafon 100%, dan cek ciri penyelenggara berizin.
2. **Bandingkan**: membandingkan sampai empat tawaran dengan satu ukuran yang sama.
3. **Kesehatan Pindar**: status dua dimensi (kualitas TWP90 dibanding nasional dan batas 5%; laju pertumbuhan dibanding median dan kuartil atas 38 provinsi), dengan Kalimantan Timur sebagai tampilan awal.
4. **Metode** (tautan di footer dan di bawah setiap hasil): tabel aturan beserta pasal sumbernya.

## Struktur file

| File | Isi |
|---|---|
| `index.html` | Struktur halaman |
| `style.css` | Tampilan |
| `app.js` | Aturan OJK (bagian 1, di bagian atas file) dan seluruh hitungan |
| `data/pindar-prov.csv` | Data per provinsi per bulan dari Statistik LPBBTI OJK, Tabel 9 |
| `dokumen/Template_Update_Data.xlsx` | Template isian data bulanan dengan validasi dan ekspor CSV |
| `dokumen/Lembar_Uji_Lampu_Pindar.xlsx` | Bukti uji: hitungan web dicocokkan dengan rumus Excel, termasuk contoh resmi SEOJK |

## Memperbarui data

Cara termudah: pakai **dokumen/Template_Update_Data.xlsx**. Isi lembar "Isian", pastikan semua cek bertuliskan OK, lalu salin kolom A di lembar "Ekspor CSV" ke baris paling bawah `data/pindar-prov.csv`.

Cara manual: tambahkan baris baru di `data/pindar-prov.csv` dengan format:

```
provinsi,bulan,rekening_aktif,outstanding_miliar,twp90_persen
Kalimantan Timur,2026-01,475000,1590.123,1.650
```

- `bulan` ditulis `TTTT-BB`.
- `outstanding_miliar` dalam miliar rupiah, titik sebagai pemisah desimal.
- `twp90_persen` dalam persen (1,65% ditulis `1.650`).
- Baris `Indonesia` wajib ada untuk setiap bulan, karena menjadi pembanding nasional.

Halaman otomatis memakai bulan terakhir yang tersedia. Pertumbuhan tahunan dibandingkan dengan bulan yang sama tahun sebelumnya; median dan kuartil dihitung ulang otomatis.

## Memperbarui aturan

Jika OJK mengubah batas, ubah objek `ATURAN` dan fungsi `batasHarian` di bagian atas `app.js`, lalu perbarui tabel di menu Metode.

## Sumber

- SEOJK 19/SEOJK.06/2025 tentang Penyelenggaraan LPBBTI (berlaku 31 Juli 2025).
- POJK 40/2024 tentang LPBBTI.
- Statistik LPBBTI OJK edisi Desember 2024 dan Desember 2025.

Alat edukasi, bukan nasihat keuangan dan bukan pengganti informasi resmi OJK. Tidak ada data pengguna yang dikirim atau disimpan.

## Hak cipta

Hak Cipta © 2026 Muhammad Ramadhani Kesuma (mrk29). Seluruh hak dilindungi. Kode sumber dapat dilihat untuk keperluan transparansi metode, tetapi penggunaan ulang, penggandaan, atau distribusi memerlukan izin tertulis dari pemegang hak cipta.

Lampu Pindar tidak berafiliasi dengan dan tidak mewakili Otoritas Jasa Keuangan.
