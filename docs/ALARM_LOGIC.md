# ALARM_LOGIC: Logika Alarm SilentGuard Lab

Dokumen ini adalah sumber kebenaran untuk kapan alarm berbunyi. Kode di `frontend/lib/alarm-machine.ts` harus mengikuti dokumen ini. Kalau aturan berubah, ubah dokumen ini dulu.

## 1. Istilah

- **Skor keramaian**: angka 0 sampai 100 hasil penghalusan probabilitas "berisik" dari model (lihat bagian 3).
- **Alarm 1**: file audio untuk ambang 60%.
- **Alarm 2**: file audio untuk ambang 80%.

## 2. Parameter (semua bisa diubah di `frontend/lib/config.ts`)

| Parameter | Default | Arti |
|---|---|---|
| `THRESHOLD_1` | 60 | Ambang alarm 1 |
| `THRESHOLD_2` | 80 | Ambang alarm 2 |
| `CALM_HOLD_SECONDS` | 3 | Skor harus berada di bawah `THRESHOLD_1` selama sekian detik sebelum sistem dianggap kembali tenang (mencegah alarm berulang akibat skor naik turun di sekitar 60) |
| `JUMP_TO_ALARM_2` | true | Jika skor melonjak langsung dari tenang ke 80 atau lebih, langsung putar alarm 2 tanpa alarm 1 |
| `SMOOTHING_WINDOW` | 5 | Jumlah hasil prediksi terakhir yang dirata-ratakan menjadi skor |

## 3. Cara menghitung skor keramaian

1. Backend mengembalikan `noise_probability` antara 0 dan 1 untuk setiap potongan audio.
2. Frontend menyimpan `SMOOTHING_WINDOW` nilai terakhir dan mengambil rata-ratanya.
3. Skor = rata-rata dikali 100, dibulatkan ke bilangan bulat.

Penghalusan membuat satu teriakan sesaat tidak langsung memicu alarm, dan angka di layar tidak loncat-loncat.

## 4. State

| State | Arti |
|---|---|
| `AMAN` | Skor di bawah `THRESHOLD_1`, atau sistem sudah kembali tenang |
| `PERINGATAN_1` | Alarm 1 sudah berbunyi dan skor masih di atas atau sama dengan `THRESHOLD_1` |
| `PERINGATAN_2` | Alarm 2 sudah berbunyi |

## 5. Transisi

| Dari | Kondisi | Ke | Aksi |
|---|---|---|---|
| `AMAN` | skor >= `THRESHOLD_1` dan skor < `THRESHOLD_2` | `PERINGATAN_1` | Putar alarm 1 |
| `AMAN` | skor >= `THRESHOLD_2` dan `JUMP_TO_ALARM_2` = true | `PERINGATAN_2` | Putar alarm 2 |
| `PERINGATAN_1` | skor >= `THRESHOLD_2` | `PERINGATAN_2` | Putar alarm 2 |
| `PERINGATAN_1` atau `PERINGATAN_2` | skor < `THRESHOLD_1` terus-menerus selama `CALM_HOLD_SECONDS` | `AMAN` | Tidak ada |
| `PERINGATAN_1` | skor >= `THRESHOLD_1` dan < `THRESHOLD_2` | `PERINGATAN_1` | Tidak ada (alarm tidak diulang) |
| `PERINGATAN_2` | skor >= `THRESHOLD_1` | `PERINGATAN_2` | Tidak ada (alarm tidak diulang) |

Aturan tambahan:
- Alarm 2 boleh memotong alarm 1 yang sedang diputar. Alarm 1 tidak pernah memotong alarm 2.
- Alarm tidak diulang selama state tidak berubah. Setiap alarm hanya berbunyi satu kali per kenaikan.
- Saat pemantauan dihentikan, state kembali ke `AMAN` dan audio alarm yang sedang berjalan dihentikan.

## 6. Keputusan terbuka (nilai default dipakai sampai diputuskan)

1. **Lonjakan langsung ke 80 atau lebih dari state `AMAN`**: default langsung alarm 2 (`JUMP_TO_ALARM_2` = true).
2. **Skor turun dari 80 ke rentang 60 sampai 79**: default tetap `PERINGATAN_2` dan diam. Alternatif: turun ke `PERINGATAN_1`, sehingga kenaikan berikutnya ke 80 membunyikan alarm 2 lagi.
3. **Pengingat berulang**: default tidak ada. Alternatif: ulangi alarm tiap N detik selama keramaian bertahan.

## 7. Implementasi referensi (TypeScript)

```ts
export type AlarmState = "AMAN" | "PERINGATAN_1" | "PERINGATAN_2";
export type AlarmSound = "alarm1" | "alarm2" | null;

export interface AlarmConfig {
  threshold1: number;
  threshold2: number;
  calmHoldMs: number;
  jumpToAlarm2: boolean;
}

export interface AlarmStep {
  state: AlarmState;
  play: AlarmSound;
}

export function createAlarmMachine(config: AlarmConfig) {
  let state: AlarmState = "AMAN";
  let calmSince: number | null = null;

  function reset() {
    state = "AMAN";
    calmSince = null;
  }

  function step(score: number, nowMs: number): AlarmStep {
    // 1. Cek apakah sistem sudah kembali tenang
    if (state !== "AMAN") {
      if (score < config.threshold1) {
        if (calmSince === null) calmSince = nowMs;
        if (nowMs - calmSince >= config.calmHoldMs) {
          state = "AMAN";
          calmSince = null;
        }
      } else {
        calmSince = null;
      }
    }

    // 2. Cek pemicu alarm
    if (state === "AMAN") {
      if (score >= config.threshold2 && config.jumpToAlarm2) {
        state = "PERINGATAN_2";
        return { state, play: "alarm2" };
      }
      if (score >= config.threshold1) {
        state = "PERINGATAN_1";
        return { state, play: "alarm1" };
      }
    } else if (state === "PERINGATAN_1" && score >= config.threshold2) {
      state = "PERINGATAN_2";
      return { state, play: "alarm2" };
    }

    return { state, play: null };
  }

  return { step, reset, getState: () => state };
}
```

## 8. Skenario uji

Gunakan tabel ini sebagai dasar unit test (`frontend/lib/alarm-machine.test.ts`). `CALM_HOLD_SECONDS` = 3.

| # | Urutan skor (tiap detik) | Alarm yang berbunyi |
|---|---|---|
| 1 | 20, 30, 40, 35 | tidak ada |
| 2 | 20, 55, 62, 65, 70 | alarm 1 satu kali (di 62) |
| 3 | 62, 70, 82 | alarm 1 (di 62), lalu alarm 2 (di 82) |
| 4 | 62, 70, 40, 40, 40, 40, 65 | alarm 1 (di 62), lalu alarm 1 lagi (di 65) |
| 5 | 20, 85 | alarm 2 langsung (JUMP_TO_ALARM_2 = true) |
| 6 | 62, 58, 63, 57, 64 | alarm 1 satu kali (skor naik turun di sekitar 60, tidak sempat tenang 3 detik) |
| 7 | 62, 85, 72, 70, 71 | alarm 1, alarm 2, lalu diam |
| 8 | 85, 40, 40, 40, 40, 62 | alarm 2, lalu alarm 1 di 62 |
