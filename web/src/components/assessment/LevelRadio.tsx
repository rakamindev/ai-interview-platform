import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { LEVEL_LABELS } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelRadioProps {
  /**
   * Menerima `null`/`undefined` secara sadar — artinya "belum ada yang memilih".
   *
   * OverridePanel.tsx:20 mengisi nilai awal radio ini dari `parseLevel(ai_level)`,
   * yang sekarang bisa mengembalikan `null`. Kalau prop ini tetap `number`,
   * pemanggil dipaksa mengarang angka, dan angka karangan itu tampil sebagai
   * radio yang SUDAH TERPILIH. Assessor yang setuju-saja lalu menyimpannya
   * sebagai penilaian manusia atas seorang kandidat — padahal tidak ada manusia
   * yang pernah menilai. Kosong itu jujur; terisi itu klaim.
   */
  value: number | null | undefined;
  onChange: (level: number) => void;
  /**
   * Nama hal yang sedang dinilai — biasanya nama skill-nya.
   *
   * Grup radio ini dipakai berulang di satu halaman (satu per skill), dan
   * sebelumnya tak satu pun punya nama. Yang melihat layar tahu bedanya dari
   * posisi dan judul di atasnya; yang mendengarkan halaman ini hanya menemui
   * tiga grup identik tanpa keterangan. Opsional, supaya penambahannya tidak
   * memaksa kelima pemanggil berubah serentak — tapi setiap pemanggil yang
   * berada di dalam `.map()` sebaiknya mengisinya.
   */
  label?: string;
  disabled?: boolean;
  className?: string;
}

export default function LevelRadio({ value, onChange, label, disabled, className }: LevelRadioProps) {
  /**
   * Cacat #8. Sebelumnya `id={`level-${level}`}` — id tetap, padahal komponennya
   * dipakai di dalam `.map()` di SkillCard.tsx:103, VacancyNewPage.tsx:91, dan
   * VacancyEditPage.tsx:80. Begitu ada dua skill, halaman itu punya dua
   * `#level-3`, dan `<Label htmlFor="level-3">` menempel ke yang PERTAMA —
   * spesifikasi HTML memang begitu.
   *
   * Akibatnya: assessor mengklik "L4" pada skill kedua, yang berubah adalah
   * skill pertama. Tidak ada error, hanya nilai yang berpindah tempat. Vacancy
   * itu lalu menjadi patokan penilaian setiap kandidat yang melamar posisi
   * tersebut, dan tidak seorang pun dari mereka pernah memilih untuk dinilai
   * dengan angka yang salah tempat.
   *
   * `useId` memberi awalan unik per instansi komponen (React 18), stabil antara
   * render server dan klien. Ini juga alasan penjagaannya ada di sini, bukan
   * berupa prop `idPrefix` yang harus diingat setiap pemanggil: yang wajib
   * diingat pasti terlupa di pemanggil berikutnya yang belum ditulis.
   */
  const uid = useId();

  /**
   * `""` = tidak ada yang terpilih. Radix membandingkan `value` Root dengan
   * `value` tiap Item; string kosong tidak cocok dengan satu pun, jadi kelima
   * radio tetap bersih. Sebelumnya `String(null)` menghasilkan `"null"` yang
   * kebetulan juga tidak cocok — kebetulan, bukan keputusan, dan tidak terbaca
   * sebagai maksud oleh siapa pun yang membacanya nanti.
   */
  const selected = value == null ? "" : String(value);

  return (
    <RadioGroup
      value={selected}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      aria-label={label ? `${label} level` : "Level"}
      className={cn("flex items-center gap-3", className)}
    >
      {[1, 2, 3, 4, 5].map((level) => {
        const itemId = `${uid}-level-${level}`;
        return (
          <div key={level} className="flex items-center gap-1">
            <RadioGroupItem value={String(level)} id={itemId} />
            <Label htmlFor={itemId} className="cursor-pointer font-normal">
              {LEVEL_LABELS[level]}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
