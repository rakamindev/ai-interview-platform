import { Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl px-4 py-10 mx-auto space-y-8">
      <div className="pb-6 space-y-3 border-b">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Shield className="w-5 h-5" />
          <span>Kepatuhan UU Perlindungan Data Pribadi (UU PDP)</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Kebijakan Privasi & Retensi Data Wawancara AI</h1>
        <p className="text-sm text-muted-foreground">Terakhir diperbarui: August 2026</p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">1. Pengumpulan Data</h2>
          <p>Selama sesi wawancara berlangsung, sistem kami mengumpulkan dan memproses data berikut:</p>
          <ul className="pl-5 space-y-1 list-disc text-muted-foreground">
            <li>Rekaman aliran audio suara langsung dari mikrofon Anda.</li>
            <li>Transkrip teks hasil konversi ucapan ke teks (*speech-to-text*).</li>
            <li>Hasil ekstraksi evaluasi kompetensi dan portofolio berbasis AI.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">2. Tujuan Pemrosesan & Penggunaan AI</h2>
          <p>
            Data audio dan transkrip Anda diproses menggunakan pemrosesan bahasa alami (LLM/AI) khusus untuk menilai kesesuaian kompetensi teknis dan profesional Anda dengan posisi pekerjaan yang dilamar. Data ini{" "}
            <strong>tidak pernah digunakan</strong> untuk pelatihan model umum AI pihak ketiga.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">3. Penyimpanan & Kebijakan Retensi Data</h2>
          <p>
            Seluruh data rekaman audio dan transkrip disimpan dalam enkripsi standar industri. Data wawancara Anda akan disimpan selama maksimum <strong>180 hari</strong> setelah sesi wawancara selesai untuk kebutuhan evaluasi tim
            rekrutmen, setelah itu data audio akan dihapus secara permanen dari sistem.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">4. Hak Subjek Data (Kandidat)</h2>
          <p>Sesuai dengan regulasi UU PDP yang berlaku, Anda memiliki hak untuk:</p>
          <ul className="pl-5 space-y-1 list-disc text-muted-foreground">
            <li>Mengakses hasil transkrip dan analisis evaluasi Anda.</li>
            <li>Mengajukan permohonan penghapusan data pribadi Anda sebelum batas waktu retensi.</li>
            <li>Menghubungi tim rekrutmen perusahaan terkait untuk klarifikasi penilaian.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">5. Kontak & Pengaduan</h2>
          <p>Jika Anda memiliki pertanyaan mengenai penggunaan data pribadi Anda, silakan hubungi Tim Perlindungan Data atau Departemen HR melalui email rekrutmen perusahaan yang mengundang Anda.</p>
        </section>
      </div>

      <div className="pt-6 text-xs text-center border-t text-muted-foreground">© 2026 Platform Evaluasi Kandidat AI. Hak Cipta Dilindungi Undang-Undang.</div>
    </div>
  );
}
