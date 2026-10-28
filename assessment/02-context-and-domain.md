# 02. Context and Domain Immersion

Step 2 of the case study. Research and writing only; no code was changed. All sources accessed 24 October 2026 unless stated. Claims without a source are tagged `[Assumption]`. Product observations come from running the app locally with obviously fake data (`api/db/seeds/dev_scenarios.rb`); the live voice interview was not run (see section 8).

---

## 1. TL;DR

1. **The decision artefact is the PDF, not the screen.** The wiki ends with the assessor exporting a PDF for the hiring manager (PRD-02 Phase 5). That PDF prints a missing AI rating as "L1, Confidence: High" with a fabricated "Gap -2", and it crashes (HTTP 500) for any portfolio a human has corrected.
2. **Honesty gaps are product gaps, not polish.** The product cannot say "not assessed" (the database forces L1 to L5), hides confidence on the fit/gap screen, and drops the human override marker. A hiring manager cannot tell a weak candidate from an unmeasured one.
3. **The market makes this costly.** Youth unemployment is 17.37% (May 2026) and about 1 million degree holders are unemployed, while 2.55 million new graduates arrive per year. When screening is a volume filter, a false "gap" silently removes people.
4. **The real leverage of an AI interview is structure, not automation.** Structured interviews are the top-ranked selection procedure in the latest meta-analysis (Sackett et al. 2022 abstract; the commonly cited .42 vs .19 for unstructured is from the paper's tables via secondary summaries, not verified), but LLM judges are inconsistent across runs and overconfident about their own confidence. The product's value depends on evidence, anchors and calibrated human review.
5. **UU PDP now has teeth and a date.** Candidates may object to decisions based solely on automated processing (UU 27/2022 Pasal 10), scoring requires a DPIA (Pasal 34), and PP 33/2026, in force 16 January 2027, requires an objection mechanism with a human alternative. Today the candidate page has no notice, no consent and no way to object.
6. **Reach is limited by the product before the candidate even speaks.** The hardware check hard-blocks anyone below 4 Mbps upload, about 15 times what the 16 kHz audio stream needs, and the UI is English-only although the assessment is set to Indonesian.
7. **Tenant isolation is broken** (finding #11): another organisation can read and overwrite a candidate's ratings. Under UU PDP this is a reportable failure, not a bug backlog item.

---

## 2. The Product: promise vs reality

**Promise (wiki).** PRD-01 calls the AI's behaviour "the most important document": probe what the candidate said, require at least one follow-up per skill, make candidates demonstrate rather than recite. Confidence is a deterministic rule (high = probe_count >= 3 and covered; low = probe_count <= 1 or initiated). PRD-02 traces one session from setup to a PDF export, with a fit/gap table showing Required, Candidate and Result per skill, and a narrative that frames gaps as "the primary area to probe in a hiring conversation".

| Area | Wiki promise | What the assessor / candidate actually gets |
|---|---|---|
| Skills not covered | Only covered skills reach the portfolio (happy path) | Prompt asks for a level for every skill in the coverage map; a missing or invalid level is stored as L1 and shown as "L1 Foundational, Confidence: HIGH" (findings #1, #2) |
| Confidence | Rule based on probes and coverage state | Asked from the model, not computed; not shown on fit/gap (#6); after an override the AI confidence is still shown next to the human level (N1) |
| Fit/gap table | Required, Candidate, Result | Required column empty on screen (#3); summary ignores "not assessed" (#5); PDF does show Required |
| Human review | "Dimas reads evidence, agrees AI rating" | Override exists but is invisible in fit/gap (#4), wiped on regeneration (#10), cannot be undone, needs no note (#15), and breaks PDF export (N12) |
| Narrative | Advisory text to guide a hiring conversation | If Gemini times out or returns 503, a template sentence is stored that looks like a real narrative ("3 matches, 0 gaps") with no label (#5, Step 1 log) |
| Invitation | Link on the app host (`app.rakamin.com/interview/...`) | Link points to the API host (N8) |
| Candidate start | "Ahmad reads brief, clicks Start" | English-only brief, no privacy notice or consent, speed test calls third parties, upload threshold blocks a 39/3.3 Mbps connection (N13, N14) |
| Failures | Not described | Portfolio failure shows "Portfolio generation failed." with no reason; candidate list shows "Completed" for failed portfolios (N15); fit/gap polling re-enqueues a job every 5 s (#7) |

**Where the decision is actually made.** Three places, in order of consequence:
1. **Portfolio review** (assessor): the only place to correct the AI before anyone else sees it.
2. **Fit/gap** (assessor or recruiter): turns levels into match / gap / exceed against a vacancy.
3. **PDF export** (sent to the hiring manager): in PRD-02 this is the final step. It is the document that leaves the system, carries no "AI generated" label, no override history and no "not assessed" state. `[Assumption]` Hiring managers decide from this PDF and a short conversation, not from the web app.

---

## 3. The Industry in Indonesia

**Scale and pressure** (BPS Sakernas via media unless stated):
- Open unemployment 4.65%, 7.22 million people (May 2026); youth aged 15 to 24: **17.37%**, rising from 16.36% in February 2026 while the overall rate fell.
- By education (May 2026): SMK 7.68%, SMA 6.17%, D4 to S3 6.09%, diploma 4.75%. About **1.03 million** degree holders unemployed.
- Supply: **2,547,717** higher-education graduates in academic year 2024/2025 (PDDikti, primary, verified).
- Demand signals: civil service intake 2024 drew **3,963,832** applicants (BKN, primary, verified). On the government job portal Karirhub, 987,204 job seekers met 104,691 new vacancies in 2025, about 9 to 10 per vacancy (secondary, via GoodStats). No credible applicants-per-vacancy data exists for private platforms.

**How screening works today** (practitioner sources, no national survey found): job ad, then CV screening (manual or ATS keyword matching), psikotes, HR interview, user interview. Known problems:
- **Volume first.** At these ratios, early stages exist to reduce numbers. `[Assumption]` Each stage is optimised for speed, not accuracy.
- **Discriminatory filters.** Age limits, appearance and marital status appear often in job ads (academic studies, no national prevalence figure). The Constitutional Court (35/PUU-XXII/2024) held that age, experience and education requirements are not discrimination per se; the Minister of Manpower's circular M/6/HK.04/V/2025 (28 May 2025) then told employers to drop age, appearance, height, marital status and ethnicity requirements unless the job genuinely needs them. A circular is guidance without sanctions.
- **Inconsistency across interviewers and campus bias**: widely discussed by practitioners, but no Indonesian empirical study found `[Gap]`.

**What is commodity vs where the leverage is.**
- Commodity: job boards and ATS (JobStreet, Glints, Kalibrr, Karir.com, government Karirhub), psychometric test bureaus (examples: Potensia, NS Development, ePPsi). `[Assumption]` These measure traits or filter by keywords; few measure demonstrated skill at scale.
- Leverage of an AI interview: the evidence base favours **structure**. Structured interviews emerged as the top-ranked selection procedure, and the revision lowered most validity estimates by .10 to .20 (Sackett et al. 2022, abstract; the specific .42 vs .19 figures come from secondary summaries and were not verified), and anchored rating scales reach inter-rater reliability around .77 to .79 (Taylor & Small 2002). An AI interviewer can deliver the same anchored probing to every candidate, at any hour, and leave quotable evidence. That is the asset; the "AI score" is not.
- Risks specific to Indonesia:
  - **Language and accent.** 74.77% of people aged 5+ speak a regional language at home (BPS Long Form Census 2020). Indonesian ASR error rises from about 10% on read speech to about 30% on spontaneous speech even after fine-tuning (Adila et al. 2024, preprint); ASR error gaps across speaker groups are well documented (Koenecke et al. 2020: WER .35 vs .19). A transcript-based rating inherits these errors.
  - **Connectivity.** Internet penetration 81.72% nationally but 69.74% in Maluku and Papua vs 85.95% in Java (APJII 2026, via Antara); median mobile download 62.54 Mbps (Ookla, May 2026, secondary). Upload is typically far lower `[Assumption]`.
  - **Model bias.** LLM resume scoring shows demographic gaps of about 1 to 3 percentage points in hiring probability, including for Gemini 1.5 Flash (An et al. 2025). LLM judges' run-to-run agreement rarely exceeds Krippendorff's alpha 0.7 (Haldar & Hockenmaier 2025) and their stated confidence is overconfident (Xiong et al. 2024).

---

## 4. What it is for

**Outcome.** Better and fairer hiring decisions, made faster, with a record a candidate could ask to see. Not "an AI score". Concretely: a hiring manager can tell, per skill, what was demonstrated, how sure we are, and what still needs checking.

**Conditions for trust** (what must stay true for assessors to keep using it):
1. **No fabricated signal.** Missing evidence must show as "not assessed", never as L1. One fabricated gap discovered by an assessor discredits every other rating `[Assumption]`.
2. **Evidence beside every level.** Quotes and the transcript link must sit next to the rating, and the narrative must be labelled as AI generated.
3. **Calibrated uncertainty.** Confidence must come from checkable facts (probe count, coverage state, transcript quality), as PRD-01 already defines, not from the model's self-report.
4. **Human correction that sticks and shows.** Overrides must survive regeneration, appear in every view and export, and carry a reason. Research warns that explanations alone raise blind acceptance (Bansal et al. 2021) and that cognitive forcing reduces but does not remove over-reliance (Buçinca et al. 2021); a required note when lowering a level is a cheap forcing function.
5. **Visible failure.** "Generating", "failed" and "stale" must be states the user can see, not an endless spinner or a silent fallback.

**Reach** (who it must also work for):
- Candidates on mobile data outside Java: the bandwidth gate must reflect the 256 kbps audio need, not 4 Mbps.
- Indonesian speakers with regional accents: UI and brief in Bahasa Indonesia when the assessment language is `id`; evidence shown as quotes so assessors can catch transcription errors.
- Candidates whose interview was cut short (network drop, time ceiling): an incomplete session must yield "not assessed", not low scores.

---

## 5. Users

No user interviews were possible; personas are built from the wiki (Dimas, "HR lead") and industry context and are marked `[Assumption]`.

| | Assessor (Dimas, HR lead) | Recruiter | Hiring manager |
|---|---|---|---|
| Day | Configures skills and anchors, sends invites in batches, reviews finished portfolios between other HR work | Runs many vacancies at once, moves candidates between stages, reports funnel numbers | Line manager with little time; reads a shortlist or PDF before a 30 to 60 minute interview |
| Job to be done | "Turn a 30 minute interview into a defensible rating I can sign off" | "Know who to advance this week without re-interviewing" | "Decide who to meet and what to probe" |
| Decision from fit/gap | Accept or correct each level; decide if a gap is real or unmeasured | Advance, hold, or reject against the vacancy | Hire / no hire, and which gaps to test in person |
| What breaks trust | Ratings with no evidence; overrides that vanish or do not show; "Completed" sessions that actually failed | Inconsistent results between similar candidates; spinners that never end | A PDF that says "Gap -2" for a skill nobody asked about; text that reads as AI certainty |

---

## 6. Candidates and UU PDP

**Journey and harm points.**

| Step | Harm if wrong | Status today |
|---|---|---|
| Invitation | Wrong link host; no information on who is recruiting | Link points to API host (N8) |
| Landing and hardware check | Blocked by an unrealistic bandwidth threshold; IP sent to third parties without notice | 4 Mbps upload gate; httpbin.org, jsdelivr, google.com called (N13) |
| Consent and notice | Recorded and scored by AI without knowing; data sent abroad without notice | No notice or consent screen (N14) |
| Interview | Accent or code-switching misheard; skill never probed due to time | ASR/LLM risks above; not observed live |
| Portfolio | Unprobed skill stored as L1 with "high" confidence | Confirmed (#1, #2) |
| Override | Correction lost or invisible | Confirmed (#4, #10, N12) |
| Fit/gap and PDF | Fabricated gaps reach the hiring manager; another organisation reads or edits the record | Confirmed (#3, #5, #11) |
| After the decision | No way to see, correct, or object to the assessment | No candidate-facing access exists `[Assumption: out of current product scope]` |

**UU PDP obligations relevant to this product** (UU 27/2022 [S1], PP 33/2026 [S2]; quotes verified against the official texts listed in section 9).

| Obligation | Article | Product implication |
|---|---|---|
| Lawful basis; explicit, written or recorded consent in simple language, with purpose and retention stated beforehand | UU Pasal 20(2)(a), 21(1), 22 | Candidate consent screen before the hardware check, in Bahasa Indonesia: recording, AI scoring, who sees results, retention, overseas processing |
| Right to object to decisions based **solely** on automated processing, including profiling ("pemrofilan") | UU Pasal 10(1); PP 33 Pasal 93 to 96 (human alternative, information about the technology) | A real human review step must exist and be recorded; the PDF must show it. A rubber stamp likely does not count `[Assumption]` |
| Accuracy, completeness, consistency | UU Pasal 29(1) | Storing L1 for "not assessed" is an accuracy failure; "not assessed" must be a first-class state |
| Records of all processing | UU Pasal 31 | Override history (who, when, from, to, why) must be kept, not overwritten or deleted |
| DPIA for high-risk processing, including automated decisions and "evaluasi, penskoran" (systematic scoring) | UU Pasal 34(2)(a),(d); PP 33 Pasal 121 (before processing) | The product is in scope; a DPIA is a launch prerequisite `[Assumption: owned by the client organisation as controller]` |
| Security and confidentiality; supervise processors | UU Pasal 35 to 39 | Tenant isolation (#11) is mandatory; raw model errors and transcripts out of logs and API responses (#12) |
| Breach notice within 3 x 24 hours to subject and authority | UU Pasal 46(1) | Cross-tenant read/write (#11) would be a notifiable breach in production |
| Processor acts on instructions; sub-processors need written approval | UU Pasal 51(1),(5) | Gemini is a sub-processor `[Assumption on roles]`; minimise what is sent (no candidate name in prompts) |
| Cross-border transfer: equivalent protection, else binding safeguards, else consent | UU Pasal 56(2) to (4); PP 33 Pasal 161 to 162 | Transcripts go to Google servers abroad `[Assumption on location]`; requires a documented basis and candidate notice |
| Retention and deletion when no longer needed | UU Pasal 43(1)(a) | Define retention for audio/transcripts per organisation `[Open question]` |
| Sanctions: administrative fine up to 2% of annual revenue per violation variable | UU Pasal 57(3) | Raises the cost of #11 and #12 from "bug" to business risk |

**Data category.** The Elucidation of Pasal 4(2)(b) defines biometric data as physical, physiological or behavioural traits that allow unique identification, "such as facial images or fingerprint data". Voice is not named. `[Assumption]` Recordings and transcripts are general personal data unless used to identify the speaker (voiceprint), in which case they become specific data. Skill ratings fit the Elucidation's description of profiling ("riwayat pekerjaan ... keandalan, perilaku").

**Implementation status.** The two-year adjustment period ended 17 October 2024 (Pasal 74). Implementing regulation **PP 33/2026** was promulgated 16 July 2026 and applies six months later, **16 January 2027** (Pasal 225). The supervisory authority (Lembaga PDP) still awaits a Presidential Regulation; Komdigi oversees in the interim (Kompas, 4 Sep 2026, secondary). No UU PDP administrative fine was found.

**Employment law.** UU 13/2003 Pasal 5 and 32(1) require equal opportunity and objective, non-discriminatory placement. Not verified whether UU 6/2023 (Cipta Kerja) amended these articles.

---

## 7. Insight to decision

The bridge to Step 3 (prioritising findings) and Step 4 (choosing solutions).

| Insight | Evidence | Portfolio | Override | Fit/Gap and export |
|---|---|---|---|---|
| Unmeasured is not weak | #1, #2; UU Pasal 29; high youth unemployment | Store and show "Not assessed" (nullable level + status); never coerce | Assessor can rate a not-assessed skill manually, with a note | "Not assessed" counted separately, never a gap; coverage shown ("6 of 9 skills evidenced") |
| Confidence must be earned, not stated | PRD-01 rule; Xiong et al. 2024; Haldar & Hockenmaier 2025 | Compute confidence from probe count and coverage; show it with evidence | Show AI confidence only for AI levels | Low-confidence results visually distinct from strong gaps |
| Human review is the legal and trust anchor | UU Pasal 10, PP 33 Pasal 94; Buçinca et al. 2021 | Evidence beside each level | Persist across regeneration, keep history, require a note when lowering, allow revert | Override visible in table and PDF ("AI L2, Assessor L3"); PDF must not crash (N12) |
| The PDF is the decision | PRD-02 Phase 5; N12 | | | Export mirrors the screen: states, overrides, "AI generated" label on narrative |
| Failure must be visible | #7, #8, #12, N15 | Failed state with a safe reason and retry, no raw errors | | Report status (generating, failed, stale); stop re-enqueueing |
| Isolation is non-negotiable | #11; UU Pasal 35 to 39, 46 | Scope every query by tenant | Scope overrides by tenant | Scope reports and exports; 404 across tenants |
| Candidates need notice and a voice | N13, N14; UU Pasal 21, 22, 56 | | | Out of scope for this revamp but recorded as follow-up: consent screen, Indonesian UI, realistic bandwidth threshold |
| Long text and small screens are normal | Step 1 scenario F | Truncate and expand evidence | | Mobile layout without horizontal overflow |

---

## 8. Assumptions and open questions

Assumptions:
- Personas and the claim that hiring managers decide from the PDF are inferred from the wiki, not from user research.
- The client organisation is the data controller, the platform a processor, and Google Gemini a sub-processor; Gemini processing location is outside Indonesia.
- Voice recordings are general personal data unless used for speaker identification.
- Human review that changes or confirms levels before a decision is enough to avoid "solely automated" under Pasal 10; a rubber stamp is not.
- Interview validity figures come from human-run interviews and do not transfer automatically to LLM-scored interviews.

Open questions for Rian / the product owner:
1. Should "not assessed" or low-confidence skills ever influence the recommendation, or only be listed for follow-up? (Proposal: listed, never counted.)
2. Who may override, and must lowering a level always require a note?
3. Retention period for audio and transcripts, and whether candidates can request their portfolio.
4. Is the PDF the official decision record? If so, it needs the same states as the screen.
5. Should the candidate consent and Indonesian UI be in this revamp or a follow-up? (Proposal: follow-up, documented.)

Limitations: the live Gemini voice interview was not run (agreed with Rian); BPS labour figures were read through media quoting BPS releases because bps.go.id did not render for automated fetch; three of those figures were spot-checked against the article text. PP 33/2026 was read from a regional government mirror (banyumaskab.go.id) because central repositories returned 404.

---

## 9. Sources

All accessed 24 October 2026.

Primary (law and official data)
- [S1] UU No. 27 Tahun 2022 (Pelindungan Data Pribadi), official copy: https://peraturan.go.id/files/Salinan+UU+Nomor+27+Tahun+2022.pdf (identical copy: https://jdih.komdigi.go.id/produk_hukum/unduh/id/832/t/undangundang+nomor+27+tahun+2022)
- [S2] PP No. 33 Tahun 2026 (Peraturan Pelaksanaan UU 27/2022), salinan: https://static.banyumaskab.go.id/website/file/peraturan_pemerintah_no._33_tahun_2026_100926115902.pdf
- [S3] UU No. 13 Tahun 2003 (Ketenagakerjaan): https://peraturan.go.id/files/UU%2013-2003.pdf
- PDDikti, Statistik Pendidikan Tinggi 2025: https://lldikti15.kemdiktisaintek.go.id/wp-content/uploads/2026/06/BUKU-STATISTIK-PENDIDIKAN-TINGGI-2025-REV-JUNI-202_260619_154442.pdf
- BKN, CPNS 2024 applicants: https://www.bkn.go.id/pendaftaran-di-portal-bkn-berakhir-jumlah-pelamar-cpns-2024-capai-39-juta/
- Kemnaker, anti-discrimination circular M/6/HK.04/V/2025: https://kemnaker.go.id/news/detail/kemnaker-larang-keras-diskriminasi-rekrutmen-tenaga-kerja
- BPS, Profil Suku dan Keragaman Bahasa Daerah (Long Form SP2020): https://www.bps.go.id/id/publication/2024/12/12/6feb932e24186429686fb57b/profil-suku-dan-keragaman-bahasa-daerah-hasil-long-form-sensus-penduduk-2020.html
- Product wiki PRD-01 and PRD-02: https://github.com/rakamindev/ai-interview-platform/wiki

Secondary (media quoting official data)
- CNBC Indonesia, Sakernas May 2026: https://www.cnbcindonesia.com/news/20260806131950-4-757114/tingkat-pengangguran-usia-15-24-terus-naik-paling-banyak-lulusan-smk
- GoodStats, TPT by education May 2026: https://data.goodstats.id/statistic/smk-jadi-kelompok-dengan-tingkat-pengangguran-tertinggi-mei-2026-t3PPM
- detik, unemployed D4 to S3 May 2026: https://www.detik.com/edu/perguruan-tinggi/d-8612638/dari-data-bps-mei-2026-sekitar-1-juta-lulusan-d4-s3-menganggur
- GoodStats, Karirhub 2025: https://data.goodstats.id/statistic/jumlah-pencari-kerja-di-karirhub-capai-987-ribu-pada-2025-lowongan-baru-104-ribu-xbo6r
- Kompas, Constitutional Court age ruling: https://nasional.kompas.com/read/2024/07/31/16441571/mk-tolak-uji-materi-soal-batas-usia-pelamar-kerja-yang-diajukan-warga-bekasi
- Antara, APJII 2026 internet survey: https://www.antaranews.com/berita/5576225/survei-apjii-penetrasi-internet-di-indonesia-2026-capai-817-persen
- Bloomberg Technoz, Ookla speed index: https://www.bloombergtechnoz.com/detail-news/104703/ranking-kecepatan-internet-ri-versi-speedtest-global-index-baru/2
- Kompas, Lembaga PDP status: https://nasional.kompas.com/read/2026/09/04/17150021/segera-bentuk-badan-pelindungan-data-pribadi?page=all

Research (peer-reviewed unless noted)
- Schmidt & Hunter (1998), doi:10.1037/0033-2909.124.2.262
- Sackett, Zhang, Berry & Lievens (2022), doi:10.1037/apl0000994
- Campion, Palmer & Campion (1997), doi:10.1111/j.1744-6570.1997.tb00709.x
- Taylor & Small (2002), doi:10.1348/096317902320369712
- Koenecke et al. (2020), doi:10.1073/pnas.1915768117
- Adila et al. (2024), arXiv:2410.08828 (preprint)
- Zheng et al. (2023), arXiv:2306.05685
- Haldar & Hockenmaier (2025): https://aclanthology.org/2025.findings-emnlp.1361/
- Xiong et al. (2024): https://openreview.net/forum?id=gjeQKFxFpZ
- An, Huang, Lin & Tai (2025), PNAS Nexus 4:pgaf089
- Goddard, Roudsari & Wyatt (2012), doi:10.1136/amiajnl-2011-000089
- Bansal et al. (2021), doi:10.1145/3411764.3445717
- Buçinca, Malaya & Gajos (2021), doi:10.1145/3449287

Regulatory comparators (not binding in Indonesia)
- EU AI Act, Regulation (EU) 2024/1689, Annex III point 4, Art. 14, 26, 86: https://eur-lex.europa.eu/eli/reg/2024/1689/oj
- NYC Local Law 144 and 6 RCNY 5-300: https://rules.cityofnewyork.us
- UK ICO, AI in recruitment outcomes report (Nov 2024): https://ico.org.uk/media2/migrated/4031620/ai-in-recruitment-outcomes-report.pdf

Product evidence (local, dummy data): `assessment/01-setup-dan-eksplorasi.md` (findings #1 to #16, N1 to N15) and `assessment/log-bukti.md`.
