import Link from "next/link";

const metrics = [
  { label: "Akurasi holdout", value: "97,50%", note: "39 dari 40 rekaman; CV 95,00% +/- 1,58 poin" },
  { label: "Fitur model", value: "107", note: "100 spektral + 7 rasio dinamis volume-invariant" },
  { label: "Algoritma", value: "Soft-Voting Ensemble", note: "SVM (0.50) + LightGBM (0.30) + ExtraTrees (0.20)" },
];

const pipeline = [
  { number: "01", title: "Ekstraksi fitur", text: "Audio mono 22.050 Hz diubah menjadi 107 fitur akustik dan rasio dinamis." },
  { number: "02", title: "Seleksi fitur", text: "SelectKBest internal per model (SVM k=70, LightGBM k=60, ExtraTrees k=65)." },
  { number: "03", title: "Klasifikasi ensemble", text: "Soft-voting ensemble menggabungkan probabilitas dengan threshold keputusan 50%." },
];

export default function ModelPage() {
  return (
    <main className="model-page">
      <header className="model-page-header">
        <Link href="/" className="btn-ghost model-back-link">← Dashboard</Link>
        <span className="badge">MODEL AKTIF · 3.0</span>
      </header>

      <section className="glass-card model-hero">
        <div className="model-hero-copy">
          <p className="eyebrow">SILENTGUARD LAB · DETAIL MODEL</p>
          <h1 className="gradient-ice-text">Model klasifikasi kebisingan</h1>
          <p>Model 3.0 menggunakan pipeline ensemble soft voting (Tuned SVM, LightGBM, dan Extra Trees) untuk mengubah 107 fitur audio menjadi probabilitas kebisingan secara real-time. Label berisik diberikan mulai threshold probabilitas 50%.</p>
        </div>
        <div className="model-accuracy" aria-label="Akurasi holdout 97,50 persen">
          <strong>97,50%</strong>
          <span>Akurasi holdout</span>
          <small>39 benar - 1 salah dari 40 file</small>
        </div>
      </section>

      <section className="model-metrics-grid" aria-label="Metrik Model 3.0">
        {metrics.map((metric) => (
          <article className="glass-card model-metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </article>
        ))}
      </section>

      <section className="model-pipeline-section">
        <div className="model-section-heading">
          <p className="eyebrow">DARI AUDIO KE PREDIKSI</p>
          <h2>Alur kerja model</h2>
        </div>
        <div className="model-pipeline-grid">
          {pipeline.map((step) => (
            <article className="glass-card model-step-card" key={step.number}>
              <span className="model-step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="model-evaluation-note">
        Hasil evaluasi terbaru adalah 97,50% pada holdout 40 file dan 95,00% +/- 1,58 poin pada 5-fold CV.
        Angka ini bukan jaminan akurasi untuk semua kondisi mikrofon. Hasil real-time dapat dipengaruhi
        oleh ruang, perangkat, jarak sumber suara, dan pengaturan gain.
      </aside>
    </main>
  );
}
