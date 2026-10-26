# Model 3.0: SilentGuard Lab

> **Universitas Trunojoyo Madura • Proyek Sains Data A**

> [!NOTE]
> Eksperimen optimasi Model 3.0 berhasil meningkatkan akurasi holdout menjadi **95.12%** dan 5-fold cross-validation menjadi **95.51%** dengan stabilitas varians yang jauh lebih baik (± 2.46%).

## 1. Hasil (holdout 20%, n=41, split identik dengan Model 2.0)

| Metrik | Model 2.0 | Model 3.0 Awal | Model 3.0 Teroptimasi |
|---|---|---|---|
| Akurasi holdout | 92.68% (38/41) | 92.68% (38/41) | **95.12% (39/41)** |
| Confusion matrix | `[[20,0],[3,18]]` | `[[20,0],[3,18]]` | **`[[20,0],[2,19]]`** |
| Precision berisik | 1.000 | 1.000 | **1.000** |
| Recall berisik | 0.857 | 0.857 | **0.905** |
| 5-fold CV (fold identik) | 93.50% ± 6.44% | 92.02% ± 2.94% | **95.51% ± 2.46%** |

Pada data uji holdout, false negative berkurang dari 3 menjadi 2 file (`24-006 berisik 2.mp3` berhasil diklasifikasikan dengan benar). Pada 5-fold cross-validation, rata-rata akurasi naik menjadi 95.51% dengan varians yang jauh lebih kecil (± 2.46%).

## 2. Arsitektur & Optimasi Model 3.0

- **107 Fitur Audio**: 100 fitur spektral dasar + 7 fitur rasio dinamis (*volume-invariant*).
- **Tuned Soft-Voting Ensemble**:
  - **Tuned SVM (RBF)**: `StandardScaler` + `SelectKBest(f_classif, k=70)` + `SVC(C=6.0, gamma=0.025, probability=True)` (bobot 0.50).
  - **LightGBM**: `StandardScaler` + `SelectKBest(f_classif, k=60)` + `LGBMClassifier(n_estimators=80, lr=0.05, max_depth=3, num_leaves=7)` (bobot 0.30).
  - **ExtraTrees**: `StandardScaler` + `SelectKBest(f_classif, k=65)` + `ExtraTreesClassifier(n_estimators=200, max_depth=5)` (bobot 0.20).

## 3. Mengapa Ada Peningkatan

- **Sensitivitas Boundary**: Penyetelan hyperparameter SVM ($C=6.0, \gamma=0.025$) bersama ekspansi seleksi fitur dari $k=60$ ke $k=70$ memberikan ruang bagi fitur rasio dinamis untuk membedakan audio berisik bervolume rendah yang sebelumnya gagal dideteksi.
- **Pengurangan Varians Ensemble**: Pembobotan baru (0.50 SVM, 0.30 LightGBM, 0.20 ExtraTrees) menyeimbangkan kelebihan masing-masing model linearitas dan tree-based, menurunkan standar deviasi fold dari ± 6.44% ke ± 2.46%.

## 4. Isi folder

```text
model3.0/
├── README.md
├── klasifikasi_berisik_audio.ipynb   # notebook lengkap (ekstraksi, evaluasi, simpan)
├── model_klasifikasi_berisik.joblib
├── model_klasifikasi_berisik.pkl
└── output_fitur_berisik.csv          # 107 fitur, 201 baris
```

## 5. Arah selanjutnya yang lebih menjanjikan

- Fitur tingkat segmen (statistik frame terkeras / top-k loudness) yang dihitung langsung dari audio mentah.
- Embedding audio pralatih (YAMNet / PANNs).
- Evaluasi dengan `StratifiedGroupKFold` per ID perekam agar estimasi lebih realistis.

