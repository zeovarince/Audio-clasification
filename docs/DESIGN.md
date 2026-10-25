# DESIGN: Sistem Visual SilentGuard Lab

Tema: **gelap, kaca buram (frosted glass), garis halus ala cetak biru**. Acuan gaya adalah style reference Authkit ("frosted glass cathedral at midnight"), disesuaikan untuk dashboard pemantauan suara. Dokumen ini mengatur tampilan. Isi halaman ada di `UI_SPEC.md`.

## 1. Karakter visual

- Latar hampir hitam, permukaan berupa panel kaca tembus pandang yang tampak disinari dari bawah.
- Teks putih kebiruan; satu aksen ungu untuk tombol aksi utama.
- Tepi komponen memakai garis dalam (inset) tipis berwarna putih kebiruan, bukan border solid.
- Jarak lega dan berirama, bukan padat.
- Waveform adalah elemen yang "bercahaya": garis gradien dengan halo lembut.

## 2. Warna

| Nama | Nilai | Token | Peran |
|---|---|---|---|
| Midnight Canvas | `#05060f` | `--color-midnight-canvas` | Latar halaman |
| Steel Plate | `#2f343e` | `--color-steel-plate` | Panel terangkat, tombol sekunder |
| Fog Veil | `#9da7ba` | `--color-fog-veil` | Teks bantu, keterangan kecil |
| Moon Mist | `#c7d3ea` | `--color-moon-mist` | Teks sekunder, label |
| Frost Glow | `#d1e4fa` | `--color-frost-glow` | Teks utama, ikon |
| Ice Highlight | `#d8ecf8` | `--color-ice-highlight` | Judul |
| Skywash | `linear-gradient(0deg, #d8ecf8 0%, #98c0ef 100%)` | `--gradient-skywash` | Wordmark, judul terbesar, garis waveform |
| Pure White | `#ffffff` | `--color-pure-white` | Teks tombol dan input |
| Void Violet | `#663af3` | `--color-void-violet` | Aksen aksi utama (lihat bagian 7) |
| Glass Edge | `rgba(186,215,247,0.12)` | `--color-glass-edge` | Garis tepi universal |
| Luminous Fill | `rgba(199,211,234,0.12)` | `--color-luminous-fill` | Latar badge dan tint lembut |
| Frosted Glass | `rgba(186,214,247,0.03)` | `--surface-frosted-glass` | Permukaan kartu |
| Deep Glass | `rgba(5,6,15,0.97)` | `--surface-deep-glass` | Modal dan panel pengaturan |

Urutan kecerahan teks: Ice Highlight (judul) lalu Frost Glow (isi) lalu Moon Mist (isi redup) lalu Fog Veil (bantu).

### Warna status (pengecualian yang disengaja)

Style reference asli bersifat monokrom. Dashboard ini butuh pembeda status yang jelas dari jauh, jadi status memakai token aksen sekunder yang sudah ada di palet, hanya di indikator status, meter, dan halo waveform. Elemen lain tetap monokrom.

| Status | Warna | Token | Tambahan |
|---|---|---|---|
| Aman | `#269684` (Deep Teal) | `--color-status-safe` | Ikon centang, teks "Lab tenang" |
| Peringatan 1 | `#e46d4c` (Ember Glow), intensitas 70% | `--color-status-warn` | Ikon peringatan, halo sedang |
| Peringatan 2 | `#e46d4c` penuh | `--color-status-alert` | Ikon seru, halo kuat, denyut pelan, teks "Terlalu berisik" |

Aturan: warna tidak pernah menjadi satu-satunya pembeda. Tiap status selalu punya ikon dan teks.

## 3. Tipografi

Font asli bersifat berlisensi, gunakan substitusi Google Fonts lewat `next/font/google`.

| Peran | Font asli | Substitusi | Bobot | Ukuran |
|---|---|---|---|---|
| UI, isi, tombol, badge | Untitled Sans | **Inter** | 400, 500, 600 | 12, 14, 16, 18, 24 px |
| Judul display, wordmark, angka persentase | aeonikPro | **Space Grotesk** | 400, 500 | 28, 44, 48 px |
| Label eyebrow huruf kapital | dotDigital | **JetBrains Mono** | 400 | 15 px, letter-spacing 0.10em |

Skala:

| Peran | Ukuran | Line height | Letter spacing |
|---|---|---|---|
| caption | 12px | 1.33 | 0 |
| body-sm | 14px | 1.43 | 0 |
| body | 16px | 1.5 | -0.16px |
| subheading | 18px | 1.33 | 0 |
| heading-sm | 24px | 1.17 | -0.24px |
| heading | 28px | 1.14 | 0 |
| heading-lg | 44px | 1.16 | 0 |
| display | 48px | 1.17 | 0 |

Aturan: judul display memakai bobot 500, jangan 600 ke atas. Angka persentase besar memakai Space Grotesk 500 dengan `font-variant-numeric: tabular-nums` supaya lebar angka stabil saat berubah.

## 4. Spasi, bentuk, dan layout

- Unit dasar 4 px. Skala: 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 100, 120.
- Lebar maksimal konten 1200 px, jarak antar section 120 px (boleh 64 px di mobile), padding kartu 24 px, jarak antar elemen 16 px.

| Elemen | Radius |
|---|---|
| Kartu dan modal | 16px |
| Badge dan input | 6px |
| Tombol | 999px (pil) |
| Wadah ikon bulat | 9999px |

Jangan mencampur keluarga radius dalam satu jenis komponen.

## 5. Elevasi

Elevasi dibangun dari highlight tepi atas (inset), cahaya dalam, dan bayangan gelap, bukan drop shadow biasa.

| Nama | Nilai |
|---|---|
| Kartu kaca | `inset 0 1px 1px rgba(199,211,234,0.12), inset 0 24px 48px rgba(199,211,234,0.05), 0 24px 32px rgba(6,6,14,0.7)` |
| Modal / panel pengaturan | `inset 0 1px 1px rgba(216,236,248,0.2), inset 0 24px 48px rgba(168,216,245,0.06), 0 16px 32px rgba(0,0,0,0.3)` |
| Garis tepi tipis | `inset 0 0 0 1px rgba(186,215,247,0.12)` |
| Halo cahaya | `0 0 6px rgba(186,207,247,0.32), 0 0 12px rgba(238,186,247,0.24)` |

## 6. Komponen

**Tombol pil (ghost, default)**: radius 999px, padding 8px 16px, latar `rgba(186,214,247,0.06)`, teks putih 14px bobot 500, garis tepi inset `rgba(186,215,247,0.12)`. Hover: latar naik ke `rgba(186,214,247,0.12)`.

**Tombol pil (outlined)**: sama dengan ghost tetapi latar transparan dan teks Frost Glow.

**Tombol aksi utama (Mulai Pemantauan)**: latar `#663af3`, teks putih, radius 999px, padding 12px 24px, bobot 500. Saat pemantauan aktif, tombol Hentikan memakai gaya ghost (bukan ungu).

**Kartu kaca**: radius 16px, latar Frosted Glass, padding 24px, tanpa border keras, elevasi "Kartu kaca".

**Badge status**: radius 6px, latar Luminous Fill, teks Frost Glow 12px bobot 500, padding 4px 8px, disertai ikon.

**Input dan slider**: radius 6px, latar `rgba(199,211,234,0.06)`, teks putih, garis tepi inset 0.12 (fokus naik ke 0.24).

**Label eyebrow**: 15px JetBrains Mono, huruf kapital, letter-spacing 0.10em, warna Moon Mist, di tengah, diapit garis tipis yang memudar dari transparan ke `rgba(186,215,247,0.12)` dan kembali transparan.

**Latar grid cetak biru**: garis 1px `rgba(186,215,247,0.06)` tiap 80 px, di-mask agar memudar di tepi, ditambah spotlight kerucut di tengah atas:
`conic-gradient(at 50% -5%, transparent 45%, rgba(124,145,182,0.3) 49%, rgba(124,145,182,0.5) 50%, rgba(124,145,182,0.3) 51%, transparent 55%)`

### Komponen khusus SilentGuard Lab

**Waveform**: canvas di dalam kartu kaca. Garis 2px dengan gradien Skywash. Saat Peringatan 1 atau 2, tambahkan `shadow blur` pada canvas dengan warna status. Garis tengah (nol) berupa hairline Glass Edge.

**Meter keramaian**: track tinggi 12px, radius 999px, latar `rgba(199,211,234,0.06)` dengan garis tepi inset. Isi mengikuti warna status. Penanda 60 dan 80 berupa garis vertikal tipis Moon Mist dengan label 12px di bawahnya.

**Indikator status (pill)**: pil dengan ikon, teks status, dan titik berdenyut kecil saat Peringatan 2.

## 7. Aturan pemakaian

### Lakukan
- Pakai radius sesuai tabel; semua elemen interaktif berbentuk pil.
- Bangun elevasi dari inset highlight dan halo, bukan drop shadow biasa.
- Pakai Void Violet hanya untuk tombol aksi utama Mulai Pemantauan.
- Pakai garis tepi inset `rgba(186,215,247,0.12)` sebagai bahasa border.
- Pakai gradien Skywash hanya untuk wordmark, judul terbesar, dan garis waveform.
- Pertahankan jarak lega antar section.
- Pasang spotlight kerucut di bagian atas halaman.

### Jangan lakukan
- Jangan menambah aksen berwarna di luar ungu (aksi utama) dan warna status.
- Jangan memakai border solid berwarna.
- Jangan memakai bobot 600 ke atas pada judul display.
- Jangan memakai drop shadow konvensional.
- Jangan menaruh teks putih di atas latar yang lebih terang dari `rgba(186,214,247,0.12)`.
- Jangan memakai gradien Skywash pada teks isi atau tombol.
- Jangan memakai gradien hangat; gradien tetap dingin (biru dan ungu).
- Jangan memakai tema terang pada versi ini.

## 8. Token siap pakai

### CSS custom properties

```css
:root {
  --color-midnight-canvas: #05060f;
  --color-steel-plate: #2f343e;
  --color-fog-veil: #9da7ba;
  --color-moon-mist: #c7d3ea;
  --color-frost-glow: #d1e4fa;
  --color-ice-highlight: #d8ecf8;
  --gradient-skywash: linear-gradient(0deg, #d8ecf8 0%, #98c0ef 100%);
  --color-pure-white: #ffffff;
  --color-void-violet: #663af3;
  --color-glass-edge: rgba(186, 215, 247, 0.12);
  --color-luminous-fill: rgba(199, 211, 234, 0.12);

  --color-status-safe: #269684;
  --color-status-warn: rgba(228, 109, 76, 0.7);
  --color-status-alert: #e46d4c;

  --surface-frosted-glass: rgba(186, 214, 247, 0.03);
  --surface-deep-glass: rgba(5, 6, 15, 0.97);

  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, monospace;

  --radius-card: 16px;
  --radius-badge: 6px;
  --radius-input: 6px;
  --radius-button: 999px;

  --page-max-width: 1200px;
  --section-gap: 120px;
  --card-padding: 24px;
  --element-gap: 16px;
}
```

### Tailwind v4

```css
@theme {
  --color-midnight-canvas: #05060f;
  --color-steel-plate: #2f343e;
  --color-fog-veil: #9da7ba;
  --color-moon-mist: #c7d3ea;
  --color-frost-glow: #d1e4fa;
  --color-ice-highlight: #d8ecf8;
  --color-void-violet: #663af3;
  --color-status-safe: #269684;
  --color-status-alert: #e46d4c;

  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, monospace;

  --radius-card: 16px;
  --radius-badge: 6px;
}
```

### Pemuatan font (Next.js)

```tsx
// frontend/app/layout.tsx
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", weight: ["400", "500"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", weight: ["400"] });
```
