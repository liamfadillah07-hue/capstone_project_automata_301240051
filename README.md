# Automata Lab — Capstone Teori Bahasa dan Otomata

Aplikasi web statis (HTML/CSS/JavaScript murni, tanpa framework/build step) yang
mengintegrasikan empat modul wajib mata kuliah Teori Bahasa dan Otomata:

| # | Modul | Fitur |
|---|-------|-------|
| 1 | **Finite State Automata** | Simulator DFA/NFA dengan trace transisi, konversi NFA → DFA (subset construction), visualisasi diagram state, serta evaluator Moore Machine & Mealy Machine |
| 2 | **Regular Expression** | Parser regex (`\| * + ? ( )`), konstruksi Thompson (regex → NFA), uji kecocokan string, konversi NFA → DFA, dan penurunan grammar reguler (Tipe 3 / right-linear) yang setara |
| 3 | **Pushdown Automata & CFG** | Pencarian derivasi leftmost pada CFG buatan pengguna, visualisasi pohon penurunan (parse tree), dan jejak konfigurasi stack PDA standar hasil konstruksi dari CFG |
| 4 | **Hierarki Chomsky & CNF** | Konversi CFG sembarang ke Chomsky Normal Form melalui tahap START → DEL → UNIT → TERM → BIN, dengan grammar hasil tiap tahap ditampilkan |

Live demo: `https://[nim-atau-nama].my.id` *(isi setelah domain di-setup, lihat bagian Deploy)*
Video demo: *(tempel link YouTube di sini)*

## Menjalankan secara lokal

Tidak ada dependency atau build step. Cukup buka `index.html` langsung di browser,
atau jalankan server statis sederhana supaya path relatif dimuat dengan benar:

```bash
# opsi 1: Python
python3 -m http.server 8080

# opsi 2: Node (http-server)
npx http-server -p 8080
```

Lalu buka `http://localhost:8080`.

## Struktur folder

```
/                     -> index.html (entry point, wajib di root agar GitHub Pages bisa langsung menyajikannya)
/src/css/style.css    -> seluruh styling
/src/js/grammar.js    -> parser teks CFG bersama (dipakai modul 3 & 4)
/src/js/fsa.js        -> engine DFA/NFA + Moore/Mealy
/src/js/regexEngine.js-> parser regex + konstruksi Thompson
/src/js/cfgEngine.js  -> pencarian derivasi leftmost + simulasi PDA
/src/js/chomsky.js    -> konversi CFG -> CNF
/src/js/svg.js        -> renderer diagram state & pohon penurunan (SVG, tanpa library)
/src/js/app.js        -> wiring UI <-> engine
/docs/                -> draft proposal & laporan ilmiah (bukan bagian dari aplikasi yang di-deploy)
/tests/               -> daftar kasus uji per modul
```

## Format input tiap modul

**FSA (Modul 1):**
```
states: q0,q1,q2
alphabet: 0,1
start: q0
final: q2
transitions:
q0,0,q0
q0,1,q1
q1,0,q2|q0     <- gunakan | untuk beberapa tujuan (NFA)
q1,1,q0
q2,0,q2
q2,1,q2
```
Gunakan simbol `e` pada kolom simbol transisi untuk transisi-ε.

**Regular Expression (Modul 2):** operator `|` (union), `*` (star), `+` (plus),
`?` (opsional), `()` (grouping), dan penulisan berdampingan untuk konkatenasi.
Contoh: `(a|b)*abb`.

**CFG / PDA (Modul 3) & Chomsky/CNF (Modul 4):**
```
S -> a S b | ab
```
Gunakan `eps` untuk ε, dan `<Nama>` untuk nonterminal bernama lebih dari satu huruf.

## Deploy ke GitHub Pages + domain `.my.id`

1. Push repositori ini ke GitHub (publik).
2. Buka **Settings → Pages**, pilih **Source: Deploy from a branch**, branch
   `main`, folder **/(root)** — karena `index.html` sudah berada di root repo.
3. Setelah GitHub Pages aktif (URL berbentuk `https://username.github.io/repo`),
   daftarkan domain `.my.id` gratis melalui `is.my.id` (atau registrar lain).
4. Tambahkan file `CNAME` di root repo berisi domain kamu (satu baris, tanpa
   `https://`), contoh isi:
   ```
   namakamu.my.id
   ```
5. Di panel DNS penyedia domain, arahkan:
   - `A` record ke IP GitHub Pages (`185.199.108.153`, `.109.153`, `.110.153`, `.111.153`), **atau**
   - `CNAME` record ke `username.github.io` jika memakai subdomain.
6. Di **Settings → Pages**, isi kolom **Custom domain** dengan domain `.my.id`
   kamu, lalu centang **Enforce HTTPS** setelah sertifikat SSL aktif (biasanya
   beberapa menit–jam setelah DNS ter-propagasi).
7. Verifikasi aplikasi dapat diakses tanpa login melalui `https://namakamu.my.id`.

## Penggunaan AI generatif (wajib dicantumkan sesuai ketentuan tugas)

> Tools yang digunakan: *(isi, misal: Claude)*
> Bagian yang dibantu AI: *(isi, misal: struktur awal engine FSA/CFG/CNF, styling)*
> Bagaimana dipahami & dimodifikasi: *(isi penjelasan personal — wajib diisi
> mahasiswa sendiri, bukan bagian yang dihasilkan otomatis)*

## Lisensi kode
Kode ini dibuat sebagai bagian dari Capstone Project individu mata kuliah
Teori Bahasa dan Otomata. Silakan gunakan sebagai titik awal, tetapi pastikan
memahami setiap baris logika sebelum mengumpulkan — dosen dapat meminta
klarifikasi lisan berdasarkan commit history.
