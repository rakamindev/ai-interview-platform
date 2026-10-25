"""Build the case-study report from recorded source, tests, and synthetic captures."""
from pathlib import Path
from xml.sax.saxutils import escape
import argparse
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Flowable, KeepTogether
from PIL import Image as PILImage

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
EVIDENCE = ROOT / 'evidence'
PR = 'https://github.com/rakamindev/ai-interview-platform/pull/192'
FORK = 'https://github.com/dixonfrederick/ai-interview-platform'
SOURCE_SHA = 'fd15a9d8a99090ec46c1c31ad28e819bf5a64286'
BASELINE_SHA = 'b836d02f45c6300b238b98ad50e66ead706723b6'
SOURCE = FORK + '/tree/' + SOURCE_SHA
BRANCH = FORK + '/tree/feat/reliable-assessment-review/assessment'
VIDEO = FORK + '/releases/download/case-study-review-v1/review-walkthrough.mp4'
CI = FORK + '/actions/runs/40207781087'
FAULT = FORK + '/commit/1ca12dc1551e52ad0c2d99a6e85a1cca8e93c0ec'
REVERT = FORK + '/commit/1426ef547306b542d7d2a1cad62bc5bf969ba5de'
TEAL = colors.HexColor('#0F6E70')
INK = colors.HexColor('#172B3A')
MUTED = colors.HexColor('#526473')
LINE = colors.HexColor('#D8E2E8')
FONTDIR = REPO / 'api/assets/fonts'
# Vera is bundled with the export, licensed for redistribution, and embeds in the PDF.
pdfmetrics.registerFont(TTFont('Review', str(FONTDIR / 'Vera.ttf')))
pdfmetrics.registerFont(TTFont('ReviewBold', str(FONTDIR / 'VeraBd.ttf')))
pdfmetrics.registerFontFamily('Review', normal='Review', bold='ReviewBold', italic='Review', boldItalic='ReviewBold')
styles = {
 'body': ParagraphStyle('body', fontName='Review', fontSize=10, leading=14.5, textColor=INK, spaceAfter=9),
 'small': ParagraphStyle('small', fontName='Review', fontSize=8.6, leading=12.5, textColor=MUTED, spaceAfter=8),
 'caption': ParagraphStyle('caption', fontName='Review', fontSize=9.5, leading=13.5, textColor=INK, spaceAfter=11),
 'h1': ParagraphStyle('h1', fontName='ReviewBold', fontSize=24, leading=30, textColor=INK, spaceAfter=14),
 'h2': ParagraphStyle('h2', fontName='ReviewBold', fontSize=14, leading=19, textColor=TEAL, spaceBefore=10, spaceAfter=8),
 'label': ParagraphStyle('label', fontName='ReviewBold', fontSize=9, leading=13, textColor=TEAL, spaceAfter=10),
 'lead': ParagraphStyle('lead', fontName='Review', fontSize=14, leading=21, textColor=INK, spaceAfter=16),
 'cell': ParagraphStyle('cell', fontName='Review', fontSize=8.8, leading=12.5, textColor=INK),
 'cellhead': ParagraphStyle('cellhead', fontName='ReviewBold', fontSize=8.8, leading=12.5, textColor=colors.white),
}
story = []

def p(text, style='body'):
    return Paragraph(text, styles[style])

def add(text, style='body'):
    story.append(p(text, style))

def link(label, url):
    return f'<link href="{escape(url, {chr(34): "&quot;"})}" color="#0F6E70"><u>{escape(label)}</u></link>'

def source_link(label, file, line=None):
    url = FORK + '/blob/' + SOURCE_SHA + '/' + file
    return link(label, url + (f'#L{line}' if line else ''))

def heading(step, title):
    if story:
        story.append(PageBreak())
    add(step, 'label')
    add(title, 'h1')

def table(headers, rows, widths):
    cells = [[p(escape(str(c)), 'cellhead') for c in headers]]
    cells += [[p(str(c), 'cell') for c in row] for row in rows]
    t = Table(cells, colWidths=widths, repeatRows=1, hAlign='LEFT')
    t.setStyle(TableStyle([
      ('BACKGROUND', (0,0), (-1,0), TEAL), ('VALIGN',(0,0),(-1,-1),'TOP'),
      ('LEFTPADDING',(0,0),(-1,-1),8), ('RIGHTPADDING',(0,0),(-1,-1),8),
      ('TOPPADDING',(0,0),(-1,-1),8), ('BOTTOMPADDING',(0,0),(-1,-1),8),
      ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F4F8F9')]),
      ('LINEBELOW',(0,0),(-1,0),0.5,TEAL), ('LINEBELOW',(0,1),(-1,-1),0.4,LINE),
    ]))
    story.extend([t, Spacer(1,10)])

class Screenshot(Flowable):
    """Place a top-left pixel crop without changing the captured image content."""
    def __init__(self, filename, box, width=499):
        super().__init__()
        self.file = EVIDENCE / filename
        self.iw, self.ih = PILImage.open(self.file).size
        self.x0, self.y0, self.x1, self.y1 = box
        if not (0 <= self.x0 < self.x1 <= self.iw and 0 <= self.y0 < self.y1 <= self.ih):
            raise ValueError(f'Crop outside {filename}: {box}')
        self.scale = width / (self.x1-self.x0)
        self.width = width
        self.height = (self.y1-self.y0)*self.scale
        self.hAlign = 'LEFT'
    def draw(self):
        c = self.canv
        c.saveState()
        clip = c.beginPath()
        clip.rect(0,0,self.width,self.height)
        c.clipPath(clip,stroke=0,fill=0)
        c.drawImage(str(self.file), -self.x0*self.scale,
            self.height-(self.ih-self.y0)*self.scale,
            width=self.iw*self.scale,height=self.ih*self.scale,mask='auto')
        c.restoreState()
        c.setStrokeColor(LINE)
        c.rect(0,0,self.width,self.height,stroke=1,fill=0)

def figure(filename, box, caption, width=499):
    story.append(KeepTogether([Screenshot(filename,box,width),Spacer(1,8),p(caption,'caption')]))

def source_image(label, filename):
    return source_link(label,'assessment/evidence/'+filename)

heading('Fullstack Product Engineer Case Study', 'Evidence-Based Fit/Gap Review')
add('Dixon Frederick', 'h2')
add('25 October 2026', 'small')
add('A missing rating is not a skill gap. This change makes the role benchmark, interview evidence, and AI or human rating source visible before a reviewer acts.', 'lead')
table(['Submission Artifact','Access'], [
 ['Open Upstream Pull Request',link('PR #192: Evidence-Based Fit/Gap Review',PR)],
 ['Code and Recorded Evidence',link('Application and Test Snapshot: fd15a9d',SOURCE)],
 ['Video Demonstration',link('3:30 Captioned Walkthrough',VIDEO)],
 ['Successful CI Execution',link('Run 40207781087: fd15a9d',CI)],
 ['Seeded Fault and Recovery',link('Fault: 1ca12dc',FAULT)+' · '+link('Revert: 1426ef5',REVERT)],
], [162,337])
add('Before and After','h2')
add('The original table showed a blank Required column and a pencil beside an overridden rating. The revised review shows required L4, effective human L3, original AI L2, and a one-level gap for the same synthetic API requirement. A separate requirement with no usable rating remains <b>Not assessed</b>.')
add('Recorded Verification','h2')
add('<b>61 backend examples</b>, <b>11 frontend tests</b>, and <b>4 browser regression tests</b> pass. Verification also covers a frontend production build, a scoped mobile accessibility scan, and migration down/up with existing rows. A deliberate arithmetic fault caused <b>28 of 35 focused examples</b> to fail before its revert.')
add('Evidence Boundaries','h2')
add('Candidate names, quotes, notes, and accounts shown are synthetic fixtures. Simulated UI failures are labeled. The live microphone/Gemini interview was not verified. AI assistance was used for analysis, implementation, tests, and report preparation; the specific checks and remaining limits are documented below.','small')
add('Application/Test Evidence Snapshot','h2')
add('Baseline: '+BASELINE_SHA+'<br/>Verified application and tests: '+SOURCE_SHA+'<br/>This report revision changes documentation and figure presentation; it does not claim new application test coverage.','small')

heading('Step 1 / Setup and Local Exploration','A Blank Benchmark at the API/UI Seam')
add('The supplied repository was cloned from main, both service READMEs and the product wiki were read, and a feature branch was created. Rails, PostgreSQL, Redis/Sidekiq, React, TypeScript, and Vite were retained. Docker in Ubuntu WSL supplied Ruby 3.3.2 and Redis without altering the existing Windows PostgreSQL installation.')
add('Vite runs on port 5174 because 5173 was occupied; the API uses 3001. A development-only, rerunnable seed provides synthetic assessment data. The selected comparison path requires no provider key.')
add('Baseline Reproduction','h2')
figure('before-comparison.png',(240,192,885,402),'<b>Original frontend with modified backend, synthetic data.</b> The Required column is blank. This is a reproduction of the presentation defect, not an untouched whole-system baseline. '+source_image('Baseline Frontend Capture','before-comparison.png'))
add('The baseline engine emits <b>expected_level</b>; the original table reads <b>required_level</b>. The first frontend regression run failed all three checks for benchmark/provenance rendering, missing-rating clarity, and empty requirements. '+source_link('Original Failing Test Log','assessment/evidence/frontend-before.txt'))
add('Exploration Scope and Timing','h2')
add('Browser exploration covered login, assessment list, a completed synthetic session, portfolio evidence, vacancy selection, comparison, refresh, transcript, and downloads. API payloads and database relationships were inspected. Backend lifecycle work had already started when the old frontend was reproduced; the full live interview was not exercised before implementation. That departure from the requested discovery sequence remains a limitation.','small')

heading('Step 2 / Context and Domain Immersion','Evidence for Reviewers and Candidates')
add('The PRDs describe an AI-led interview, transcript-backed skill evidence, and a vacancy comparison. The selected outcome is a defensible follow-up decision: identify what meets the benchmark, what falls below it, and what was never established. The roles below are hypotheses from the brief and PRDs, not user-interview findings.')
table(['Person','Review Need','Design Consequence'],[
 ['Assessor','Inspect the evidence and correct an AI rating.','Show quotes, notes, original AI level, and effective human level.'],
 ['Recruiter','Compare observed skills with the role benchmark.','Place required and observed levels together; separate missing evidence from gaps.'],
 ['Hiring Manager','Decide what needs another conversation.','Filter gaps, unassessed requirements, and low-confidence AI ratings.'],
 ['Candidate','Avoid an unsupported or uncorrectable negative assessment.','Do not invent L1, erase a human review, or expose another tenant\'s data.'],
],[88,180,231])
add('An Indonesian Hiring Context','h2')
add('Kemnaker\'s Pasker portal links to Karirhub and already displays public vacancies. It also publishes vacancy datasets by education, occupation, and experience requirements. These are observable discovery and eligibility services. This assessment tool needs to add evidence of demonstrated skill beyond a listing or eligibility field.')
add('<b>Design inference:</b> prioritize required-versus-observed levels and correctable evidence over another generated hiring verdict. This does not establish that every competing assessment product lacks those features. A useful next check is whether recruiters can explain a follow-up decision from the evidence without treating an unassessed skill as a failure.','small')
add('Candidate Privacy and UU PDP','h2')
add('UU 27/2022 covers correction (Article 6), access/copies (Article 7), objections to solely automated decisions with legal or significant effects (Article 10), and security/confidentiality (Articles 35-36). The design supports inspection, correction, and tenant boundaries. Retention, notices, legal bases, and provider agreements require separate work; no compliance certification is claimed.','small')
add('Sources and Research Timing','h2')
add(link('PRD 01: Evidence and Confidence','https://github.com/rakamindev/ai-interview-platform/wiki/PRD-01-%E2%80%94-First-Principles:-AI-Interview-Behavior')+' · '+link('PRD 02: Interview and Review','https://github.com/rakamindev/ai-interview-platform/wiki/PRD-02-%E2%80%94-Real-Simulation:-End%E2%80%90to%E2%80%90End-Interview')+'<br/>'+link('Kemnaker Pasker: Services and Vacancy Datasets','https://paskerid.kemnaker.go.id/')+' · '+link('UU 27/2022: Official Text','https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/')+'<br/>PRD/privacy context was documented on 25 October. The more specific public-service comparison above was added during the 26 October report review.','small')

heading('Step 3 / Problem and Gap Analysis','Assessment Integrity Takes Priority')
add('P0: broad exposure/unusable system. P1: incorrect assessment or unauthorized disclosure. P2: recoverable reliability/workflow issue. P3: minor clarity/polish. These are qualitative priorities, not measured incident probabilities.','small')
table(['ID / Severity','Finding and User Impact','Type / Implemented Response'],[
 ['F1 · P1','Required levels disappear; reviewers cannot inspect the benchmark behind a gap.','Defect at the API/UI seam. One expected_level contract.'],
 ['F2 · P1','Rating provenance disappears; reviewers cannot distinguish AI output from human judgment.','Serialization defect. Include original/effective levels, source, and notes.'],
 ['F3 · P1','Child lookups omit tenant ownership; a signed-in assessor can attempt foreign portfolio/skill IDs.','Controller defect. Owned session joins and vacancy checks.'],
 ['F4 · P2','Repeated generation and unrecorded failures can strand a reviewer or discard an old report.','Defect / missing lifecycle specification. Tokens, status, timeout detection, and retry.'],
 ['F5 · P1','Model ratings are coerced into 1..5 and skills deleted before validation; ratings or reviews can be wrong or lost.','Generator defect. Strict validation, atomic writes, retained human reviews.'],
 ['F6 · P1','Culture fit and hiring recommendations are requested without grounded evidence.','Missing evidence policy. Deterministic summary; no culture/hiring inference.'],
 ['F7 · P3','Incomplete summaries and missing edge states make follow-up harder.','Defect / missing state design. Completeness counts and recovery states.'],
],[70,239,190])
add('Priority Revision','h2')
add('The initial plan assigned F6 P2. The final report treats it as P1 because an unsupported hiring recommendation could affect candidate evaluation, rather than merely interrupt a recoverable workflow. This is a revised risk judgment, not a measured incident or a retroactive change to the initial plan.','small')
add('Early Constraint Signal','h2')
add('The original interview depends on live Gemini credentials and audio. Shared tenant/auth assumptions and the worker contract require review. The chosen comparison can operate without a provider, allowing one end-to-end review workflow within the four-day constraint. The initial plan records these dependencies before feature implementation. '+source_link('Initial Discovery and Acceptance Plan','assessment/01-discovery-and-plan.md'),'small')

heading('Step 4 / Strategy and Trade-Offs','A Deterministic Review within the Existing Stack')
add('The original plan compared a frontend field repair, a persisted deterministic comparison, and replacement of the interview engine. The selected change addresses the benchmark defect together with provenance, authorization, refresh correctness, and failure recovery.')
table(['Original Option','Value and Work Required','Cost, Failure, and Decision'],[
 ['A. Field Repair','Correct the frontend field with minimal API change.','Quick benchmark visibility; leaves stale snapshots, lost reviews, and tenant lookup defects. Rejected as too narrow.'],
 ['B. Persisted Review','Add lifecycle metadata, snapshot inputs, worker guards, and review states.','API/web maintainers own the digest and retry policy. Additive migration is reversible. Selected; reviewer-driven retry is still required.'],
 ['C. Interview Replacement','Rework model behavior, live audio, and the generation pipeline.','Expands provider and real-time failure surfaces. Cannot establish reliable evidence within this scope. Deferred.'],
],[95,195,209])
add('Closer Alternative: Queue Recovery','h2')
add('The implementation chose commit-before-enqueue with timeout detection and explicit retry instead of an outbox. The comparison below makes that operational trade-off explicit during this report revision; it is not presented as an earlier experiment.')
table(['Approach','Operation and Maintenance','What It Gives Up'],[
 ['Selected: Token + Retry','Keep the existing Rails/Sidekiq stack. A two-minute threshold exposes stuck work; a reviewer requests a new attempt. Maintainers own the timeout and recovery copy.','A crash after commit can leave no queued job. No automatic re-enqueue or fixed recovery-time guarantee.'],
 ['Alternative: Outbox','Persist a dispatch event with the report transaction. Add an idempotent dispatcher, retry/backoff policy, and monitoring; the backend team owns the new process.','More schema and operational work. Still needs idempotent workers and queue recovery. Rollback must account for undelivered events.'],
],[111,213,175])
add('Why the Selected Trade-Off Fits','h2')
add('The review remains usable with a preserved snapshot and visible retry while requiring fewer new moving parts. If abandoned pending reports or unattended recovery become material, an outbox offers a specific benefit worth the added maintenance. No workload threshold or saved engineering hours has been measured.','small')

heading('Step 4 / Acceptance Criteria','Defined Behavior for Missing and Changed Evidence')
add('Acceptance criteria were recorded before the feature changes. The implementation checks below organize them by observable behavior; the original plan remains available without rewriting its history. '+source_link('Pre-Implementation Plan','assessment/01-discovery-and-plan.md'))
criteria = [
 ('Benchmark','Compare every vacancy requirement in stable order. Show required/effective levels and a signed delta.'),
 ('Identity','Use normalized canonical IDs. Restrict label fallback to custom skills; ambiguous duplicates remain unassessed.'),
 ('Missing Ratings','Use not_assessed and no numeric delta for a missing/invalid rating. Never fabricate L1 by coercion.'),
 ('Human Review','Retain original AI level, effective level, source, notes, and review time. Changed inputs invalidate cached comparisons.'),
 ('Authorization','Require portfolio/session and vacancy tenant ownership for review, export, override, and worker execution. Reject missing auth, wrong roles, and foreign IDs.'),
 ('Job Lifecycle','Deduplicate active requests and deliveries with status/token checks. Expose an old pending/generating attempt as timed out after two minutes; recovery requires explicit retry.'),
 ('Saved Content','Preserve the last successful snapshot during refresh failure or partial writes. Block comparison exports while stale or processing.'),
 ('Decision Limits','Keep comparison deterministic and provider-independent. Do not infer culture fit or issue an automatic hiring recommendation.'),
 ('Data and UI Safety','Use an additive reversible migration. Handle loading, empty, error, partial, long-text, narrow-screen, and keyboard states.'),
 ('Proof','Exercise backend/frontend/browser regressions, seed and revert a fault, and document a checked/corrected AI contribution.'),
]
for i,(label,text) in enumerate(criteria,1):
    add(f'<b>{i}. {label}.</b> {text}')
add('Scoring Assumptions','h2')
add('L1-L5 are ordered categories, not a calibrated interval score. A signed level difference supports follow-up; it is not an overall fit percentage. A complete portfolio may still leave some vacancy requirements unassessed. A human override remains the effective rating until explicitly revised.')

heading('Step 5 / Engineering Execution','Versioned Inputs and Atomic Report Writes')
add('FitGap::Snapshot reads ordered requirements, ratings, quotes, summaries, and override provenance. A SHA-256 digest identifies the inputs behind a successful comparison. Canonical identity avoids matching unrelated skills merely because their labels are the same.')
table(['Lifecycle Field','Purpose'],[
 ['generation_status','pending, generating, complete, failed, or stale. Existing rows without a digest require refresh.'],
 ['generation_token / requested_at','Identify an attempt and its timeout threshold. An obsolete delivery cannot replace a newer request.'],
 ['source_digest','Detect changed requirements or review inputs on reads and exports.'],
 ['error_code','Safe queue_unavailable, generation_failed, or derived generation_timeout. No provider payload is stored here.'],
],[153,346])
add('Request and Worker Sequence','h2')
add('1. Resolve the tenant and owned portfolio/vacancy.<br/>2. Lock the portfolio; reuse a current/active report or save a pending token.<br/>3. Commit before enqueueing the Sidekiq job.<br/>4. Worker resolves ownership, takes the same lock, and checks the token.<br/>5. Compute comparisons and atomically save the successful snapshot.<br/>6. On worker exception, roll back partial data and record a safe failure.')
add('Timeout Detection and Recovery','h2')
add('After two minutes, an outstanding attempt is exposed as failed when its status is read. This does not automatically re-enqueue it or stop a running process. A reviewer must explicitly retry; completion depends on that action and queue availability. An enqueue exception retains the previous successful comparison. Exports require a current digest.')
add('Portfolio Validation and Data Safety','h2')
add('Missing levels stay absent; malformed, non-integer, and out-of-range levels fail validation. Invalid response fragments roll back the write. Matching skills retain human overrides, and human-reviewed skills are kept if a provider omits them. Migration down/up preserved existing comparisons and owning rows; restored legacy reports were stale until refreshed. '+source_link('Migration Check','api/script/verify_review_migration.rb'),'small')

heading('Step 5 / Review Interface','Required Levels and Human Rating Sources')
add('The review extends the existing light Rakamin teal system: completeness first, benchmark and observed rating second, supporting evidence on demand. Text accompanies status colors. The captures below use synthetic data and retain the application\'s original text casing.')
add('Assessed Requirements Stay Visible','h2')
figure('after-desktop.png',(145,275,875,373),'<b>Three of four requirements assessed.</b> One requirement needs more evidence; the count does not call it a demonstrated gap.')
add('Human Review Retains the Original AI Level','h2')
figure('after-desktop.png',(570,744,1140,820),'<b>RESTful API Design, left to right:</b> required L4, effective human L3, original AI L2, and a one-level gap. These are synthetic acceptance-fixture values.')
add('Quotes and Notes Explain the Revision','h2')
figure('after-desktop.png',(140,751,555,974),'<b>Synthetic evidence and assessor note.</b> The note explains the L3 revision while the comparison keeps the original AI source available.',width=415)
add(source_image('Desktop Review: Full Capture','after-desktop.png'),'small')

heading('Step 5 / Missing Evidence and Mobile Review','Unassessed Skills Remain Distinct from Gaps')
add('On narrow screens, requirement rows become stacked cells. The two details below come from the same 375-pixel capture and are enlarged for reading inside this PDF.')
mobile_columns = Table([[
 [p('Keyboard Evidence Disclosure','h2'), Screenshot('after-mobile.png',(20,895,355,1215),235), Spacer(1,8),
  p('<b>Synthetic mobile fixture.</b> Enter opens this focused disclosure. This verifies activation of that control, not full keyboard traversal.','caption')],
 [p('Missing Ratings Stay Unassessed','h2'), Screenshot('after-mobile.png',(20,1730,355,1935),235), Spacer(1,8),
  p('<b>Communication requires L3 but has no observed rating.</b> It remains Not assessed, with no numeric delta.','caption')],
]], colWidths=[244,243], hAlign='LEFT')
mobile_columns.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),
 ('RIGHTPADDING',(0,0),(0,0),9),('RIGHTPADDING',(1,0),(1,0),0),('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0)]))
story.append(mobile_columns)
add(source_image('Mobile Review: Full Capture','after-mobile.png'),'small')
add('Scoped Accessibility and Long Text','h2')
add('The mobile browser check programmatically focuses an evidence control and presses Enter, then runs an axe WCAG A/AA scan. The scoped scan has no reported violations after the active-navigation contrast fix. A separate 320-pixel test checks an unbroken long label for document overflow. Neither check certifies the whole product or PDF accessibility.','small')

heading('Step 5 / Failed Refresh and Recovery','Previous Evidence Survives a Failed Refresh')
add('These details show an explicitly simulated queue-failure API response for UI testing. They demonstrate the visible failure state; they are not footage of a real queue outage.')
add('A Visible Error and an Explicit Retry','h2')
figure('simulated-failed-refresh.png',(140,275,880,385),'<b>Simulated queue failure.</b> The message names the unavailable queue, confirms preservation, and offers Retry comparison.')
add('The Saved Snapshot Keeps Its Status','h2')
figure('simulated-failed-refresh.png',(145,438,875,535),'<b>Previous snapshot.</b> The assessed count and human-review context remain visible, with the snapshot identified as previous.')
add('Exports Stay Disabled Until the Report Is Current','h2')
figure('simulated-failed-refresh.png',(800,122,1155,162),'<b>Refresh remains available; PDF and JSON are disabled.</b> This prevents downloading a comparison presented as current after refresh failure.',width=355)
add(source_image('Simulated Refresh Failure: Full Capture','simulated-failed-refresh.png'),'small')
add('Other Tested States','h2')
add('Frontend tests cover initial-load failure/retry, a pending portfolio, stale exports, refresh failure, and download failure with Check status recovery. Browser response simulations also cover long labels and an empty vacancy. '+source_link('Frontend Lifecycle Checks','web/src/pages/fitgap/FitGapReportPage.test.tsx')+' · '+source_link('Browser State Checks','web/e2e/review.spec.ts',60),'small')

heading('Step 5 / Verification and AI Review','Regression Evidence with a Defined Scope')
table(['Check','Recorded Result and Evidence'],[
 ['Backend','61 examples, 0 failures: all 25 level pairs, tenant denial, malformed inputs, identity, provenance, duplicate jobs, safe failures, and rollback. '+source_link('Backend Log','assessment/evidence/backend-tests.txt')],
 ['Frontend','11 tests pass; TypeScript/Vite production build succeeds. '+source_link('Frontend Log','assessment/evidence/frontend-tests.txt')+' · '+source_link('Build Log','assessment/evidence/frontend-build.txt')],
 ['Browser','4 regression checks: real API evidence/filter/refresh/download/transcript flow; narrow-screen Enter/axe checks; labeled failed-refresh, long-label, and empty simulations. '+source_link('Browser Log','assessment/evidence/browser-tests.txt')],
 ['Migration','Down/up preserves comparisons and owning rows; restored legacy report requires refresh. '+source_link('Migration Script','api/script/verify_review_migration.rb')],
 ['Dependencies','Recorded production npm audit: 0 advisories. Inherited development-tool advisories are not represented as cleared. '+source_link('Production Audit JSON','assessment/evidence/production-dependency-audit.json')],
],[98,401])
add('Interaction Claims Match the Tests','h2')
add('Browser checks operate disclosure, filtering, refresh/retry, PDF/JSON download, and transcript navigation. Frontend checks exercise initial-load retry and Check status recovery. The recorded walkthrough enters from the portfolio. Return-to-portfolio links and a complete Tab/Shift+Tab route are not claimed as tested by those records. '+source_link('Exact Browser Actions','web/e2e/review.spec.ts',18),'small')
add('Seeded Fault and Revert','h2')
add('On a scratch branch, subtraction was replaced by addition. The focused suite produced 28 failures in 35 examples. The fault was committed and reverted; assertions were not weakened. '+link('Fault 1ca12dc',FAULT)+' · '+link('Revert 1426ef5',REVERT)+' · '+source_link('Failure Log','assessment/evidence/seeded-fault.txt'),'small')
add('AI Verification and Correction','h2')
add('An AI-generated browser selector initially missed an evidence control whose accessible label includes skill-specific text. It was corrected to target the summary element while retaining the behavior assertion. The reviewable test focuses that control, presses Enter, and asserts that details is open; it does not prove full keyboard traversal. During this report review, the broader AI-authored all-controls claim was removed after checking those exact actions. '+source_link('Verified Disclosure Assertion','web/e2e/review.spec.ts',46),'small')
add('A dependency review also replaced the initially selected Vitest 3.2.x with 5.0.5. The original audit output was not retained, so this revision does not assert exact historical package/advisory severity. The committed lockfile and successful CI establish the final versions and checks. '+source_link('Dependency Lockfile','web/package-lock.json')+' · '+link('Exact Successful CI Run',CI),'small')

heading('Step 6 / Delivery and Limits','Submission Artifacts and Remaining Work')
add('Submission Artifacts','h2')
add(link('Open Upstream PR #192',PR)+'<br/>'+link('3:30 Captioned Video Demonstration',VIDEO)+'<br/>'+link('Revised Report Source and Documentation',BRANCH)+'<br/>'+link('Verified Application and Test Snapshot',SOURCE)+'<br/>'+link('Successful CI Run for That Snapshot',CI))
add('The video contains an actual local API/worker browser recording using synthetic fixtures, slowed for readability. Queue-failure footage is labeled as a response simulation. It has explanatory on-screen text and no spoken narration. This PDF is the single portal document; external links provide code, proof, and video.','small')
add('Material Limits','h2')
limits = [
 'The live microphone/Gemini interview was not exercised. Provider validation/failure paths use controlled clients; the comparison itself makes no model call.',
 'The two-minute threshold detects old attempts; it does not dispatch lost jobs. Explicit reviewer retry and queue availability determine recovery. An outbox remains an alternative.',
 'Protection is scoped to report, export, and override paths. Whole-product auth/WebSocket auditing, rights-request workflows, retention, and provider contracts remain separate work.',
 'Previously coerced AI levels cannot be reconstructed without original responses. Current override storage keeps the current review, not an immutable revision ledger.',
 'No production-load, time-saving, fairness, or hiring-accuracy improvement has been measured. Synthetic acceptance tests establish behavior, not business effectiveness.',
]
for item in limits:
    add('• '+item,'small')
add('Release and Rollback','h2')
add('Apply the additive migration before the new code. Drain legacy two-argument fit/gap jobs before switching to the three-argument worker. Rollback preserves comparison/portfolio data but removes lifecycle metadata. The local-only Compose runtime contains documented synthetic credentials; production configuration is outside this change.','small')
add('Runbook and Defense Preparation','h2')
add(source_link('Setup, Checks, and Rollback Runbook','assessment/RUNBOOK.md')+'<br/>'+link('Separate Technical Defense Preparation',FORK+'/blob/2e3c81b15b29b31578c0f8e1d641e3c9a33c873c/assessment/DEFENSE.md'),'small')

def chrome(canvas,doc):
    canvas.saveState()
    w,h = A4
    canvas.setFillColor(TEAL)
    canvas.rect(0,h-8,w,8,fill=1,stroke=0)
    canvas.setFont('Review',8)
    canvas.setFillColor(MUTED)
    canvas.drawString(48,29,'Dixon Frederick | Rakamin Case Study')
    canvas.drawRightString(w-48,29,str(doc.page))
    canvas.restoreState()

parser = argparse.ArgumentParser()
parser.add_argument('--output',required=True)
args = parser.parse_args()
output = Path(args.output)
output.parent.mkdir(parents=True,exist_ok=True)
doc = SimpleDocTemplate(str(output),pagesize=A4,rightMargin=48,leftMargin=48,topMargin=42,bottomMargin=46,
    title='Evidence-Based Fit/Gap Review - Dixon Frederick',author='Dixon Frederick (prepared with AI assistance)')
doc.build(story,onFirstPage=chrome,onLaterPages=chrome)
print(output)
