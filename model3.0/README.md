# Model 3.0 - SilentGuard Lab

Folder ini berisi notebook, artefak, dan hasil ekstraksi fitur Model 3.0. Ringkasan berikut mengikuti output terbaru yang tersimpan di `klasifikasi_berisik_audio.ipynb`.

## Hasil evaluasi terbaru

| Evaluasi | Model 2.0 (baseline) | Model 3.0 (soft voting) |
|---|---:|---:|
| Holdout, 40 file | 97,50% (39/40) | **97,50% (39/40)** |
| Stratified 5-fold CV, 200 file | 95,00% +/- 4,74 poin persentase | **95,00% +/- 1,58 poin persentase** |

Skor per fold Model 3.0 adalah **95,00%, 95,00%, 92,50%, 95,00%, dan 97,50%**. Tiap fold menguji 40 file; secara gabungan hasilnya 190 prediksi benar dan 10 salah dari 200 file.

Confusion matrix holdout Model 3.0 dengan urutan kelas `[non-berisik, berisik]` adalah `[[20, 0], [1, 19]]`: satu file berisik terprediksi non-berisik. Holdout dan CV memakai pembagian evaluasi berbeda, jadi nilainya tidak harus sama. Angka tersebut adalah hasil eksperimen pada dataset ini, bukan jaminan performa untuk rekaman baru.

## Arsitektur

Model 3.0 menggunakan **107 fitur audio** dan soft-voting ensemble:

- SVC RBF dengan standardisasi dan `SelectKBest(k=70)`, bobot 0,50.
- LightGBM dengan standardisasi dan `SelectKBest(k=60)`, bobot 0,30.
- Extra Trees dengan standardisasi dan `SelectKBest(k=65)`, bobot 0,20.

Probabilitas kelas berisik dibandingkan dengan threshold **0,50**.

## Isi folder

- `klasifikasi_berisik_audio.ipynb` - ekstraksi fitur, pelatihan, evaluasi, inspeksi kesalahan, dan penyimpanan model.
- `MODEL_KLASIFIKASIV3-0.joblib` dan `MODEL_KLASIFIKASIV3-0.pkl` - artefak model tersimpan.
- `output_fitur_berisik.csv` - 107 fitur untuk 200 file.
- `output_fitur_segmen_berisik.csv` - hasil ekstraksi fitur segmen audio.
- `requirements.txt` - dependensi notebook/model.

## Batasan evaluasi

Holdout dilakukan per file. Jika beberapa file berasal dari rekaman atau sesi yang sama, file terkait mungkin tersebar ke train dan test. Untuk mengukur generalisasi ke perekam atau sesi baru, gunakan pembagian data berbasis grup. Label berisik/non-berisik mengikuti anotasi dataset, bukan pengukuran ambang desibel objektif.
