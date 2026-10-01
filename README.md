# anatomy-quiz

Web quiz anatomi berbasis model 3D interaktif. User membaca deskripsi struktur,
lalu mengklik struktur yang dimaksud pada model 3D.

Region v1: **ekstremitas superior dextra** — 136 struktur, 24 soal.

## Menjalankan lokal

```
python -m http.server 8000
```

Lalu buka http://localhost:8000

Harus lewat server, karena `fetch('questions.json')` gagal pada protokol `file://`.

## Teknologi

Vanilla HTML/CSS/JS, tanpa build step dan tanpa dependency.
Satu-satunya script eksternal: Sketchfab Viewer API.

## Struktur file

| File | Isi |
|---|---|
| `config.js` | Registry region → model UID Sketchfab |
| `viewer.js` | Pembungkus Sketchfab Viewer API |
| `quiz.js` | Logika quiz |
| `questions.json` | Bank soal |

## Konvensi penamaan node

```
os_   tulang      os_humerus
m_    musculus    m_biceps-brachii-caput-longum
n_    nervus      n_medianus
a_    arteri      a_brachialis
v_    vena        v_cephalica
```

Nama object pada model 3D = jawaban quiz.

## Atribusi

Model 3D anatomi berbasis **BodyParts3D**
© Database Center for Life Science (DBCLS), lisensi **CC BY-SA**.

Mesh tulang, otot, arteri, dan vena diseleksi dari dataset tersebut, dinamai
ulang, diperbaiki skalanya, dan diberi material untuk keperluan edukasi.

Jalur n. medianus, n. ulnaris, dan n. radialis dimodelkan terpisah karena
tidak tersedia di dataset sumber.

Model turunan dipublikasikan di Sketchfab dengan lisensi CC BY-SA mengikuti
lisensi sumbernya.

## Lisensi

Kode dan bank soal: bebas dipakai untuk keperluan edukasi.
Model 3D: CC BY-SA, mengikuti BodyParts3D.
