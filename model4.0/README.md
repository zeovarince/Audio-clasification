# Model 4.0: SilentGuard Lab (Pure SVM Teroptimasi)

> **Universitas Trunojoyo Madura • Proyek Sains Data A**

> [!NOTE]
> Eksperimen Model 4.0 berfokus pada **model tunggal Support Vector Machine (Pure SVM RBF)** tanpa arsitektur ensemble. Dengan penambahan 5 fitur akustik Generasi 4 (total 112 fitur) dan penyetelan hyperparameter ($C=12.0, \gamma=0.025, k=80$), akurasi holdout test berhasil melonjak menjadi **97.56% (40 dari 41 file benar)**.

---

## 1. Perbandingan Hasil Evaluasi (Holdout Test 20%, n=41)

| Metrik | Model 2.0 (Baseline SVM) | Model 3.0 (Ensemble Voting) | **Model 4.0 (Pure SVM Teroptimasi)** |
|---|---|---|---|
| **Metode / Arsitektur** | Pipeline SVM Tunggal | Soft-Voting (SVM + LightGBM + ExtraTrees) | **Pipeline SVM RBF Tunggal (Tanpa Ensemble)** |
| **Jumlah Fitur** | 100 fitur | 107 fitur | **112 fitur** |
| **Akurasi Holdout** | 92.68% (38/41) | 95.12% (39/41) | **97.56% (40/41)** 🚀 |
| **Peningkatan vs Model 2.0** | - | +2.44% | **+4.88%** |
| **Confusion Matrix** | `[[20, 0], [3, 18]]` | `[[20, 0], [2, 19]]` | **`[[20, 0], [1, 20]]`** |
| **Precision (Berisik)** | 1.000 | 1.000 | **1.000 (0 false alarm)** |
| **Recall (Berisik)** | 0.857 | 0.905 | **0.952** |
| **Ukuran Model File** | 72 KB | 824 KB | **91 KB (Ultra-ringan)** |
| **Ketergantungan Eksternal** | Standar | Butuh LightGBM | **Mandiri (Hanya scikit-learn)** |

---

## 2. Arsitektur Pipeline Model 4.0 Pure SVM

```python
Pipeline([
    ('scaler', StandardScaler()),
    ('selector', SelectKBest(f_classif, k=80)),
    ('svc', SVC(C=12.0, gamma=0.025, kernel='rbf', probability=True, random_state=42))
])
```

- **5 Fitur Akustik Baru (Generasi 4):**
  1. `peak_to_p50`: $RMS_{p95} - RMS_{p50}$ (mengukur lonjakan energi vokal terhadap volume ruangan rata-rata).
  2. `crest_factor`: $RMS_{p95} - RMS_{p5}$ (rasio puncak terhadap lantai kebisingan terendah).
  3. `std_sum`: Akumulasi variabilitas vokal percakapan ($\sum_{i=1}^3 \text{MFCC}_{i\_std}$).
  4. `vocal_ratio`: Fokus spektrum pita frekuensi vokal manusia ($300\text{ Hz}-2\text{ kHz}$).
  5. `hf_spectral`: Kontras pita frekuensi tinggi vs rendah.

---

## 3. Berkas di Folder `model4.0/`

- `klasifikasi-audioV4.ipynb`: Notebook Jupyter lengkap dengan grafik visualisasi & output eksekusi.
- `model_klasifikasi_berisik.joblib`: Model biner final untuk deployment backend (91 KB).
- `model_klasifikasi_berisik.pkl`: Alternatif pickle biner (91 KB).
- `output_fitur_berisik.csv`: Dataset 112 fitur untuk 201 file audio.
- `README.md`: Dokumentasi komparasi teknis.

