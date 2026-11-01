import Link from "next/link";

const metrics = [
  { label: "Akurasi holdout", value: "97,56%", note: "40 dari 41 rekaman" },
  { label: "Fitur model", value: "110", note: "80 fitur dipilih untuk klasifikasi" },
  { label: "Algoritma", value: "SVC RBF", note: "C = 3 · gamma = 0,025" },
];

const pipeline = [
  { number: "01", title: "Ekstraksi fitur", text: "Audio mono 22.050 Hz diubah menjadi 110 fitur akustik." },
  { number: "02", title: "Seleksi fitur", text: "SelectKBest memilih 80 fitur yang paling informatif." },
  { number: "03", title: "Klasifikasi", text: "SVC dengan kernel RBF menghasilkan probabilitas suara berisik." },
];

export default function ModelPage() {
  return (
    <main className="model-page">
      <header className="model-page-header">
        <Link href="/" className="btn-ghost model-back-link">← Dashboard</Link>
        <span className="badge">MODEL AKTIF · 5.0</span>
      </header>

      <section className="glass-card model-hero">
        <div className="model-hero-copy">
          <p className="eyebrow">SILENTGUARD LAB · DETAIL MODEL</p>
          <h1 className="gradient-ice-text">Model klasifikasi kebisingan</h1>
          <p>Model 5.0 menggunakan pipeline SVC RBF untuk mengubah 110 fitur audio menjadi probabilitas kebisingan secara real-time. Label berisik diberikan mulai threshold probabilitas 60%.</p>
        </div>
        <div className="model-accuracy" aria-label="Akurasi holdout 97,56 persen">
          <strong>97,56%</strong>
          <span>Akurasi holdout</span>
          <small>40 benar · 1 salah dari 41 file</small>
        </div>
      </section>

      <section className="model-metrics-grid" aria-label="Metrik Model 5.0">
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
        Angka 97,56% adalah hasil evaluasi holdout pada 41 rekaman, bukan jaminan
        akurasi untuk semua kondisi mikrofon. Hasil real-time dapat dipengaruhi
        oleh ruang, perangkat, jarak sumber suara, dan pengaturan gain.
      </aside>
    </main>
  );
}
