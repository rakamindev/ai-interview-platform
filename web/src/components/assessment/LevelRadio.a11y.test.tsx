import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import LevelRadio from "@/components/assessment/LevelRadio";

/**
 * Cacat #8 — `id={`level-${level}`}` di LevelRadio.tsx:42.
 *
 * Id itu global untuk seluruh dokumen, sementara komponennya dipakai di dalam
 * `.map()` pada tiga tempat:
 *   pages/vacancies/VacancyNewPage.tsx:91   (satu grup per skill)
 *   pages/vacancies/VacancyEditPage.tsx:80  (satu grup per skill)
 *   components/assessment/SkillCard.tsx:103 (satu kartu per skill)
 *
 * Jadi begitu sebuah vacancy punya dua skill, halaman itu berisi dua `#level-3`.
 * `<Label htmlFor="level-3">` menunjuk elemen PERTAMA dengan id tersebut, dan
 * spesifikasi HTML meneruskan klik label ke kontrol itu — bukan ke kontrol yang
 * ada di sebelahnya secara visual.
 *
 * Akibatnya berlapis, dan lapisan pertamanya yang paling mahal:
 *
 * 1. Pengguna mengklik "L4" pada skill kedua; yang berubah adalah skill
 *    pertama. Skill kedua tetap di nilai lamanya. Tidak ada pesan error —
 *    hanya nilai yang berpindah tempat. Vacancy itu lalu menjadi patokan
 *    penilaian setiap kandidat yang melamar posisi tersebut, dan tidak seorang
 *    pun dari mereka pernah memilih untuk dinilai dengan angka yang salah
 *    tempat.
 *
 * 2. Karena semua label menempel ke grup pertama, radio di grup kedua dan
 *    seterusnya kehilangan nama aksesibelnya. Pengguna screen reader mendengar
 *    "radio, tidak berlabel" lima kali.
 *
 * 3. Grup radionya sendiri tidak punya nama sama sekali, di semua kondisi.
 *    Tiga grup berurutan terdengar identik: tidak ada cara mendengar grup ini
 *    milik skill yang mana.
 */
describe("LevelRadio — pemakaian ganda di satu halaman", () => {
  function renderTwoGroups() {
    const onCommunication = vi.fn();
    const onRootCause = vi.fn();
    render(
      <>
        <LevelRadio label="Communication" value={null} onChange={onCommunication} />
        <LevelRadio label="Root Cause Analysis" value={null} onChange={onRootCause} />
      </>
    );
    return { onCommunication, onRootCause };
  }

  it("mengubah grup yang labelnya diklik, bukan grup pertama di halaman", async () => {
    const { onCommunication, onRootCause } = renderTwoGroups();

    const groups = screen.getAllByRole("radiogroup");
    expect(groups).toHaveLength(2);

    await userEvent.click(within(groups[1]).getByText("L4"));

    expect(onRootCause).toHaveBeenCalledWith(4);
    expect(onCommunication).not.toHaveBeenCalled();
  });

  it("memberi nama pada setiap radio, di grup mana pun ia berada", () => {
    renderTwoGroups();

    /**
     * Dua grup, jadi harus ada tepat dua radio bernama "L3" — satu di
     * masing-masing grup. Sebelum perbaikan, kedua label menempel ke radio yang
     * sama, jadi radio grup pertama bernama "L3 L3" dan radio grup kedua tidak
     * bernama apa pun. Pencarian by-role di sini persis cara screen reader
     * menelusuri halaman.
     */
    expect(screen.getAllByRole("radio", { name: "L3" })).toHaveLength(2);
  });

  it("tidak pernah memakai satu id untuk dua radio berbeda", () => {
    renderTwoGroups();

    const ids = screen.getAllByRole("radio").map((el) => el.getAttribute("id"));
    expect(ids).toHaveLength(10);
    expect(ids.every((id) => !!id)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("menamai grupnya sehingga bisa dibedakan saat didengar, bukan hanya saat dilihat", () => {
    renderTwoGroups();

    expect(screen.getByRole("radiogroup", { name: /communication/i })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /root cause analysis/i })).toBeInTheDocument();
  });

  it("tetap punya nama grup ketika pemanggil tidak memberi konteks", () => {
    render(<LevelRadio value={3} onChange={() => {}} />);

    /**
     * Nama generik masih lebih baik daripada tanpa nama: pengguna setidaknya
     * mendengar sedang berada di pemilih level. Ini juga menjaga agar prop
     * `label` tetap opsional, sehingga penambahannya tidak memaksa kelima
     * pemanggil berubah dalam satu langkah.
     */
    expect(screen.getByRole("radiogroup", { name: /level/i })).toBeInTheDocument();
  });
});
