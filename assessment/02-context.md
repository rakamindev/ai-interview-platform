# Step 2: Context and domain immersion

How I read the product, its users and the people it affects, before deciding what to change.
Statements about the product come from using it (Step 1, Task B) and from the wiki PRDs. Statements
about the wider market are my reasoning, not measured data; I did not find figures I could verify
in the time available, so there are none here.

## 1. The product, as it behaves

An AI voice interviewer (Gemini Live) talks to a candidate for 10 to 90 minutes about a configured
set of skills. While it talks, a coverage map tracks each skill from `not_yet` through `initiated`
and `partial` to `covered`, with a hard rule that a skill cannot pass `initiated` before two
probes. When the session ends, a background job sends the transcript and coverage map to a model,
which returns a level from L1 to L5 per skill with evidence quotes and a summary. An assessor can
override a level. A fit/gap report then compares the levels with a vacancy and adds two narrative
paragraphs, one of which reads like a hiring recommendation. Portfolio and report export to PDF
and JSON, which is what reaches a hiring manager.

What the code implies and what the product does were not the same. The code implies a careful
pipeline (coverage states, probe gates, confidence rules in the PRD). In use, every one of those
signals was dropped at the last step: the model was free to rate a skill the coverage map said was
never reached, and the screens showed that rating with the same weight as a well-probed one.

## 2. The industry: hiring and assessment in Indonesia

- **Volume.** Entry-level and intern roles attract far more applicants than a team can interview.
  The scarce resource is a qualified person's time to talk to candidates, not the candidates.
- **Commoditized:** CV parsing and keyword screening, applicant tracking, online aptitude and
  coding tests, video interview recording. These are widely available and cheap to switch between.
- **Where the leverage is:** a structured, evidence-backed signal about how a person actually
  thinks, produced consistently and at the cost of software instead of a senior engineer's hour.
  That only has value if a recruiter can trust it enough to act on it without re-interviewing.
- **Working conditions that matter here.** Candidates often interview from a phone on a mobile
  connection, at home, sometimes in a second language. Dropped audio, a noisy room or a switch
  between Bahasa Indonesia and English are normal, not edge cases. The assessment supports `en`
  and `id`; the transcript mixes both.

## 3. What the product is for, and what has to stay true

The outcome is a hiring decision that is faster and fairer than a CV screen. For that to keep
being useful:

1. **A rating must be earned.** If the interview did not reach a skill, the product must say
   "not assessed", not "weak". Otherwise it is worse than no signal, because it looks like one.
2. **Thin evidence must look thin.** One question is a hint; three probes with quotes is a rating.
   The PRD already defines this as confidence; the screens must carry it.
3. **A human stays in the loop, visibly.** The assessor's override is the decision; the AI text is
   a draft. Both the UI and the exported PDF have to make that distinction readable.
4. **The data stays with the company that collected it.** Tenant isolation is a precondition for
   selling this to more than one client.

What would make it matter to more people: hiring managers forwarding the PDF without editing it,
and candidates being re-invited rather than rejected when an interview went wrong technically.

## 4. The users

| User | Their day | What they need from these screens |
|---|---|---|
| Recruiter / assessor | Many candidates per role; skims results between calls; decides who moves on | In seconds: which ratings are solid, which are thin, which were never measured; correct the AI and move on |
| Hiring manager | Reads a PDF or a shared link, rarely the product itself | Required vs candidate on every row; no verdict on unmeasured skills; clear when a human changed a rating |
| Tenant admin (implied) | Owns the client relationship | Confidence that another company cannot see or change their candidates |

## 5. The people affected who never chose it

Candidates do not pick this tool and cannot opt out of it. A wrong result costs them an
opportunity they may not get again this year, and they never see why.

Seen at runtime (Task B): a candidate whose audio broke after one sentence received "Gap" on every
skill and a narrative saying they were "not yet at the level to independently contribute". Nothing
in the product told the assessor that the interview had simply not happened. Designing for
candidates here means: an unmeasured skill is unknown, a failed session is a reason to re-invite,
and the person's words are never turned into a judgement the interview did not support.

## 6. UU PDP (Law No. 27 of 2022 on Personal Data Protection)

Checked against the published text (sources below), not from memory. I am not a lawyer; this is
how the provisions bear on product decisions.

| Provision | What it says (paraphrased) | What it means for this product |
|---|---|---|
| Pasal 10 ayat (1) | A data subject may object to a decision based solely on automated processing, including profiling, that has legal effects or a significant impact on them. | A hiring decision is a significant impact. The assessor's override and the "AI-written draft" labels are not cosmetic: they are what keeps the decision from being solely automated. There is no way yet for a candidate to object (F9, escalated). |
| Pasal 34 ayat (1)-(2) | The controller must carry out a data protection impact assessment when processing has a high risk; the list includes automated decision-making with legal or significant effects, and evaluation or scoring. | This product does exactly that. A DPIA is a prerequisite for the client, and the product should help them write it (what is processed, where it goes, how long it is kept). Escalated. |
| Pasal 16 ayat (1) | Processing principles include telling the subject the purpose and activities of processing, and deleting data when the retention period ends or on the subject's request. | There is no consent or notice screen, no retention period and no deletion path for audio, transcripts or portfolios (F9). Personal data in logs (N1) was fixed in this change. |

Sources: [Pasal 34, pasal.id](https://pasal.id/peraturan/uu/uu-no-27-tahun-2022/pasal-34);
[UU 27/2022 text on Wikisource, page with Pasal 10](https://id.wikisource.org/wiki/Halaman:UU_Nomor_27_Tahun_2022_Tentang_Perlindungan_Data_Pribadi.pdf/6);
[page with Pasal 16](https://id.wikisource.org/wiki/Halaman:UU_Nomor_27_Tahun_2022_Tentang_Perlindungan_Data_Pribadi.pdf/9);
[Hukumonline on DPIA under Pasal 34](https://www.hukumonline.com/berita/a/memahami-data-protection-impact-assessments-dalam-pelindungan-data-pribadi-lt667615ca09b2e/).

## 7. What this led to

The highest-leverage change is not a new feature. It is making the existing pipeline honest at the
point where it turns evidence into a judgement about a person, and making sure that judgement stays
inside the company that owns it. That is the slice in Step 4 (`04-revamp-strategy.md`).
