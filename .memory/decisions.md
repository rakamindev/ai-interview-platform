# Decisions

> Newest first. One line for small decisions:
> `- YYYY-MM-DD · decision — reason. #tag @path/ (source)`
> A block for bigger ones:
> `### YYYY-MM-DD · Title #tag @path/` + `Why:` / `Rejected:` / `Revisit if:`
> Add `#hold` to freeze an area: agents must ask before editing files under its @path.
> Never delete reversed decisions — mark them `~~…~~ superseded YYYY-MM-DD → see …`.

### 2026-10-20 · Usulan scope revamp: "hasil yang bisa dipertanggungjawabkan" (menunggu konfirmasi user) #revamp @api/app/services/portfolios/ @api/app/services/fit_gap/ @web/src/pages/portfolio/ @web/src/pages/fitgap/
Why: bukti runtime (topics/step3-gap-and-plan.md) — skill tak dinilai jadi L1/"Gap"/"not recommended", override hilang, report basi, IDOR lintas tenant. Ini titik di mana produk merugikan kandidat dan menghilangkan kepercayaan assessor/HM (unassessed skills, missing ratings, model failures, data types, long text).
Rejected: patch presentasi saja (DB/export tetap bohong); perbaikan prompt saja (bergantung LLM yang tak stabil); revamp realtime/consent kandidat (terlalu besar untuk satu slice, didokumentasikan sebagai constraint).
Revisit if: user memilih fokus lain (mis. alur kandidat/UU PDP) atau TL menolak migrasi di DB bersama.
