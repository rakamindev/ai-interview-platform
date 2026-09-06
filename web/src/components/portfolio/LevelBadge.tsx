import { LEVEL_LABELS, LEVEL_BADGE_CLASSES, LEVEL_DESCRIPTIONS, parseLevel } from "@/utils/constants";
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
  /**
   * Menerima `null`/`undefined` secara sadar.
   *
   * `parseLevel` sekarang mengembalikan `number | null` — "saya tidak tahu"
   * adalah jawaban yang sah, dan jawaban itu harus punya tempat untuk mendarat.
   * Kalau prop ini tetap `number`, setiap pemanggil dipaksa menambal sendiri
   * dengan `?? 1` atau `!` — persis kebiasaan yang membuat cacat #5 ada sejak
   * awal, hanya berpindah tempat.
   */
  level: number | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

export default function LevelBadge({ level, size = "md", className }: LevelBadgeProps) {
  /**
   * Divalidasi ulang di sini, bukan hanya di pemanggil.
   *
   * Alasannya bisa dilihat di OverridePanel.tsx:53 — `override_level` masuk ke
   * badge tanpa melewati parseLevel, karena tipenya memang sudah `number`.
   * Penjagaan yang disebar ke setiap pemanggil akan bocor di tempat seperti itu,
   * lalu bocor lagi di pemanggil berikutnya yang belum ditulis. Komponen ini
   * satu-satunya yang mengindeks LEVEL_LABELS/CLASSES/DESCRIPTIONS, jadi di sini
   * pula batas yang menjaga ketiga peta itu dari kunci yang tidak dikenalnya.
   */
  const parsed = parseLevel(level);

  /**
   * Kotak kosong adalah kegagalan yang paling mahal di komponen ini: tidak
   * terlihat seperti error, hanya seperti bug styling — jadi tidak ada yang
   * melaporkannya, dan assessor mengambil keputusan tentang seorang kandidat
   * tanpa pernah tahu ada rating yang tidak sampai kepadanya.
   */
  if (parsed === null) {
    return (
      <div
        aria-label="Level unknown"
        title="Level data is unavailable or out of the valid L1–L5 range."
        className={cn(
          "inline-flex flex-col items-center justify-center rounded font-semibold",
          size === "md" ? "px-3 py-2 min-w-14 text-base" : "px-2 py-1 min-w-10 text-sm",
          "bg-muted text-muted-foreground border border-dashed",
          className
        )}
      >
        <span aria-hidden="true">—</span>
        {size === "md" && <span className="text-[10px] font-normal opacity-70">Unknown</span>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded font-semibold",
        size === "md" ? "px-3 py-2 min-w-14 text-base" : "px-2 py-1 min-w-10 text-sm",
        LEVEL_BADGE_CLASSES[parsed],
        className
      )}
    >
      <span>{LEVEL_LABELS[parsed]}</span>
      {size === "md" && (
        <span className="text-[10px] font-normal opacity-70">{LEVEL_DESCRIPTIONS[parsed]}</span>
      )}
    </div>
  );
}
