# Daftar Kasus Uji

Total: 40 kasus uji (10 per modul), mengacu pada definisi default yang sudah
dimuat otomatis di aplikasi. Isi kolom "Hasil Aktual" dan "Status" setelah
menjalankan pengujian manual, lalu pindahkan tabel ini ke Bab V laporan.

## Modul 1 — FSA
DFA default: menerima string biner yang **berakhiran "01"** ditelusuri lewat
state q2 sebagai final (lihat definisi bawaan di aplikasi).

| # | Input | Diharapkan | Hasil Aktual | Status |
|---|-------|------------|--------------|--------|
| 1 | `01`   | Diterima |  |  |
| 2 | `010`  | Diterima |  |  |
| 3 | `0110` | Ditolak |  |  |
| 4 | `1010` | Diterima |  |  |
| 5 | `111`  | Ditolak |  |  |
| 6 | `` (kosong) | Ditolak |  |  |
| 7 | `00001` | Ditolak |  |  |
| 8 | `00101` | Diterima |  |  |
| 9 | `1`     | Ditolak |  |  |
| 10 | `01010101` | Diterima |  |  |

## Modul 2 — Regular Expression
Pola default: `(a|b)*abb`

| # | Input | Diharapkan | Hasil Aktual | Status |
|---|-------|------------|--------------|--------|
| 1 | `abb` | Cocok |  |  |
| 2 | `aabb` | Cocok |  |  |
| 3 | `aababb` | Cocok |  |  |
| 4 | `bababb` | Cocok |  |  |
| 5 | `ab` | Tidak cocok |  |  |
| 6 | `abbb` | Tidak cocok (lihat catatan: hanya diterima jika berakhir tepat "abb") |  |  |
| 7 | `aaaabb` | Tidak cocok |  |  |
| 8 | `` (kosong) | Tidak cocok |  |  |
| 9 | `bbabb` | Cocok |  |  |
| 10 | `aabba` | Tidak cocok |  |  |

## Modul 3 — CFG / PDA
Grammar default: `S -> a S b | ab`

| # | Input | Diharapkan | Hasil Aktual | Status |
|---|-------|------------|--------------|--------|
| 1 | `ab` | Diterima |  |  |
| 2 | `aabb` | Diterima |  |  |
| 3 | `aaabbb` | Diterima |  |  |
| 4 | `aaaabbbb` | Diterima |  |  |
| 5 | `a` | Ditolak |  |  |
| 6 | `abb` | Ditolak |  |  |
| 7 | `aabbb` | Ditolak |  |  |
| 8 | `` (kosong) | Ditolak |  |  |
| 9 | `ba` | Ditolak |  |  |
| 10 | `aaaaabbbbb` | Diterima |  |  |

## Modul 4 — Hierarki Chomsky & CNF
Grammar default: `S -> A B | eps`, `A -> a A | a`, `B -> b B | b`

| # | Pemeriksaan | Diharapkan | Hasil Aktual | Status |
|---|-------------|------------|--------------|--------|
| 1 | Tahap DEL muncul | Ya (S nullable) |  |  |
| 2 | S -> ε dipertahankan di hasil akhir | Ya |  |  |
| 3 | Semua produksi non-ε berbentuk A → BC | Ya |  |  |
| 4 | Semua produksi berbentuk A → a untuk satu terminal | Ya |  |  |
| 5 | Tidak ada produksi unit tersisa (A → B) | Ya |  |  |
| 6 | Uji grammar `S -> A`, `A -> a A b c | eps` memicu tahap UNIT & BIN | Ya |  |  |
| 7 | Uji grammar tanpa ε dan tanpa unit tidak memicu tahap DEL/UNIT | Ya |  |  |
| 8 | Nonterminal baru hasil TERM hanya memproduksi satu terminal | Ya |  |  |
| 9 | Nonterminal baru hasil BIN membentuk rantai biner yang benar | Ya |  |  |
| 10 | Start simbol baru ditambahkan jika start lama muncul di RHS | Ya |  |  |
