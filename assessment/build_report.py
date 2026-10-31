from pathlib import Path
import json
from xml.sax.saxutils import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether

ROOT = Path(__file__).resolve().parent
links = json.loads((ROOT / 'submission-links.json').read_text(encoding='utf-8'))
results = json.loads((ROOT / 'evidence/results.json').read_text(encoding='utf-8'))
assert all(results[key]['passed'] for key in ['api', 'web_unit', 'browser', 'build']), 'Do not publish an unverified report'
assert json.loads((ROOT / 'evidence/manual-demo.json').read_text(encoding='utf-8'))['passed'], 'The real API demonstration must complete first'
assert links['pull_request'].startswith('https://github.com/')
assert links['video'].startswith('https://')
fonts = ROOT.parent / 'api/app/assets/fonts'
pdfmetrics.registerFont(TTFont('Vera', str(fonts / 'Vera.ttf')))
pdfmetrics.registerFont(TTFont('Vera-Bold', str(fonts / 'VeraBd.ttf')))
pdfmetrics.registerFontFamily('Vera', normal='Vera', bold='Vera-Bold', italic='Vera', boldItalic='Vera-Bold')
INK = colors.HexColor('#0f172a')
TEAL = colors.HexColor('#006b73')
MUTED = colors.HexColor('#475569')
LINE = colors.HexColor('#cbd5e1')
WIDTH = A4[0] - 84
styles = {
    'title': ParagraphStyle('title', fontName='Vera-Bold', fontSize=29, leading=35, textColor=INK, spaceAfter=17),
    'h1': ParagraphStyle('h1', fontName='Vera-Bold', fontSize=19, leading=25, textColor=INK, spaceAfter=15),
    'h2': ParagraphStyle('h2', fontName='Vera-Bold', fontSize=11, leading=16, textColor=TEAL, spaceBefore=12, spaceAfter=6),
    'body': ParagraphStyle('body', fontName='Vera', fontSize=9.2, leading=13.5, textColor=INK, spaceAfter=8),
    'small': ParagraphStyle('small', fontName='Vera', fontSize=8, leading=11, textColor=MUTED, spaceAfter=6),
    'cell': ParagraphStyle('cell', fontName='Vera', fontSize=8, leading=11, textColor=INK),
    'label': ParagraphStyle('label', fontName='Vera-Bold', fontSize=9, leading=14, textColor=TEAL, spaceAfter=10),
}
story = []

def p(text, style='body'):
    return Paragraph(text, styles[style])

def add(text, style='body'):
    story.append(p(text, style))

def heading(step, title):
    add(step, 'label')
    add(title, 'h1')

def table(headers, rows, widths):
    cells = [[p(escape(str(value)), 'cell') for value in row] for row in [headers] + rows]
    item = Table(cells, colWidths=widths, repeatRows=1, hAlign='LEFT')
    item.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#edf6f6')),
        ('LINEBELOW', (0,0), (-1,0), 0.8, TEAL),
        ('LINEBELOW', (0,1), (-1,-1), 0.35, LINE),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 8), ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8), ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(item)
    story.append(Spacer(1, 9))

def screenshot(name, max_height=500, max_width=WIDTH):
    image = Image(str(ROOT / 'evidence/screenshots' / name))
    ratio = min(max_width / image.imageWidth, max_height / image.imageHeight)
    image.drawWidth = image.imageWidth * ratio
    image.drawHeight = image.imageHeight * ratio
    image.hAlign = 'LEFT'
    story.append(image)

def newpage():
    story.append(PageBreak())

add('Fullstack Product Engineer case study', 'label')
story.append(Spacer(1, 22))
add('Evidence-first<br/>Fit/Gap review', 'title')
add('An explainable comparison that keeps missing evidence visible, preserves human rating provenance, and protects access between organizations.')
add('28 October 2026 | Rails + PostgreSQL + React + TypeScript', 'small')
story.append(Spacer(1, 16))
table(['What changes', 'Why it matters'], [
    ['One typed comparison contract', 'Required and assessed levels are readable together; every vacancy requirement remains visible.'],
    ['Uncertainty and human provenance', 'Missing assessment is not presented as a low rating. Assessor overrides and AI confidence remain distinct.'],
    ['Authenticated tenant boundary', 'Portfolio, comparison, export, and override paths constrain access through the owning session.'],
    ['Deterministic calculation', 'This workflow no longer depends on model availability or repeated background generation.'],
], [180, WIDTH-180])
add('Review artifacts', 'h2')
add('<link href="' + escape(links['pull_request']) + '"><u>Open the GitHub Pull Request</u></link>')
add('<link href="' + escape(links['video']) + '"><u>Watch the 3-minute demonstration</u></link>')
add('The demonstration uses synthetic records and Indonesian subtitles. Code and documentation were developed with AI assistance.', 'small')
add('Scope: the post-interview portfolio-to-vacancy review. Live audio interviews and upstream Gemini portfolio generation are outside the verified slice.', 'small')

newpage()
heading('Steps 1-2', 'Setup, product context, and people affected')
add('Starting point', 'h2')
add('Cloned the supplied repository at b836d02f45c6300b238b98ad50e66ead706723b6 and created a feature branch from main. Read both service READMEs, schema, controllers, services, React report and product wiki PRDs. Static inspection ran in parallel with Windows bootstrap; workflow and database claims were then validated on the running app. Wiki filenames incompatible with Windows were read from Git blobs into safe local filenames.')
add('Local execution', 'h2')
add('The Windows host initially had Node but no Ruby, PostgreSQL, Redis or Docker on PATH. Prepared a workspace-local Ruby 3.3.2 runtime, native compiler, and a PostgreSQL instance bound to 127.0.0.1:55432. Native dependency compilation needed C17 because the newer compiler default was incompatible with Ruby 3.3 headers. No system database or real candidate data was used.')
add('What the product is for', 'h2')
add('An assessor reviews an interview-derived skill portfolio, corrects a rating when justified, then compares it against a vacancy. The useful outcome is a defensible next step: accept an assessment, inspect its evidence, or collect missing evidence. The report is not a replacement for a hiring decision.')
table(['Person', 'Decision supported / potential harm'], [
    ['Assessor', 'Check evidence, explain a correction, and identify the rating that actually drives the comparison.'],
    ['Recruiter', 'See which requirements need follow-up instead of mistaking missing measurement for poor skill.'],
    ['Hiring manager', 'Compare proficiency against an explicit role requirement and understand uncertainty.'],
    ['Candidate', 'Avoid unsupported low ratings and keep interview material within the appropriate organization.'],
], [105, WIDTH-105])
add('Domain grounding and limits', 'h2')
add('OPM guidance supports using consistent rating scales, but its fixed-question interview method differs from this adaptive PRD. Only the scale-consistency principle informs this design. The brief identifies Indonesian hiring and UU PDP as context; tenant protection and synthetic artifacts address a concrete privacy boundary. These personas are hypotheses from the brief/wiki, not findings from conducted user interviews.')

newpage()
heading('Step 3', 'Problems ranked by user impact')
add('Severity definitions: P0 blocks release for unauthorized access; P1 can distort an assessment decision; P2 prevents reliable completion or recovery; P3 is a smaller usability defect.', 'small')
table(['Priority / type', 'Observed flaw and impact', 'Decision'], [
    ['P0 / defect', 'Unscoped portfolio and override lookups can expose another tenant\'s assessment material to a permitted assessor with a known ID.', 'Scope ownership through session; bind tenant to authenticated JWT.'],
    ['P1 / defect', 'API expected_level and web required_level disagree. The recruiter sees no required level.', 'Use the actual API contract and assert visible L3/L4 text.'],
    ['P1 / defect', 'Label-keyed aggregation drops repeated requirements; label fallback can merge different IDs.', 'One row per requirement; ID-first, conservative custom matching.'],
    ['P1 / insufficient evidence', 'Culture/hiring prose is requested from skill patterns without behavioral evidence.', 'Remove unsupported prose from this workflow; require separate human review.'],
    ['P2 / defect', '404 polling requeues generation; regeneration deletes the prior report before replacement.', 'On-demand deterministic computation and atomic upsert; explicit retry.'],
    ['P2 / missing specification', 'Ambiguous matching and confidence after overrides lack a complete policy.', 'Define null semantics and preserve AI confidence separately from human provenance.'],
    ['P3 / defect', 'Silent failures and rigid report layouts impede recovery and small-screen review.', 'Named navigation, recovery states, wrapping and stacked rows.'],
], [80, 249, WIDTH-329])
add('Constraint signal to the technical lead', 'h2')
add('Upstream portfolio generation still coerces invalid model levels with to_i.clamp(1, 5) and replaces skills before all new rows are validated. That separate P1 issue can manufacture low ratings or leave partial data. It must be addressed before treating upstream AI output as validated evidence; this submission does not claim that fix.')
add('Also reconcile the yearless 19 August deadline with the hiring portal and audit remaining tenant paths before a wider release.', 'small')

newpage()
heading('Step 4', 'Solution options and acceptance criteria')
table(['Option', 'Benefit / cost', 'Trade-off'], [
    ['A. Rename the field', 'Smallest change; restores a visible required level.', 'Leaves matching, tenant isolation, uncertainty and failure-loop problems.'],
    ['B. Deterministic review (chosen)', 'Fast and explainable; no provider/queue dependency for arithmetic.', 'Automated culture prose is removed; human behavioral review remains necessary.'],
    ['C. Durable asynchronous AI pipeline', 'Could preserve prose with explicit status, retry and leases.', 'More schema/coordination cost; evidence grounding and provider evaluation still required.'],
], [132, 190, WIDTH-322])
add('Why B fits this codebase', 'h2')
add('Comparing a small set of skill levels is deterministic. Removing the external model from that calculation eliminates its latency, timeout and duplicate-generation failure paths. The existing JSONB report and unique portfolio/vacancy index are sufficient. Retain narrative columns for rollback; no destructive schema migration or artificial new column is introduced.')
table(['Acceptance criterion', 'Correct behavior'], [
    ['Typed levels', 'Integer L1-L5 in API, web and export; invalid/missing values stay null.'],
    ['Complete requirements', 'One row per vacancy requirement, including repeated labels and unassessed skills.'],
    ['Conservative identity', 'Prefer canonical IDs; do not merge different IDs; ambiguous custom matches stay unresolved.'],
    ['Explicit provenance', 'Assessor rating wins; show its source and keep AI confidence correctly labeled.'],
    ['Protected access', 'Authenticate role and tenant; scope portfolio/session, vacancy, export and override paths.'],
    ['Reliable refresh', 'Read changed overrides/requirements; upsert one report; preserve prior data if writes fail.'],
    ['Usable states', 'Loading, retry, empty, partial, long text, mobile, keyboard and export failure are represented.'],
    ['Honest decision boundary', 'No missing-data penalty, culture inference, fit percentage or automated hiring recommendation.'],
], [138, WIDTH-138])

newpage()
heading('Step 5', 'Implementation and failure behavior')
table(['Layer', 'Responsibility'], [
    ['React report', 'Fetch the portfolio and comparison once. Explain coverage and rating provenance; filter follow-up; recover on user retry; export current data.'],
    ['Rails controller', 'Require assessor/admin role, bind tenant to authenticated claims, constrain records, validate readiness and inputs.'],
    ['FitGap::Engine', 'Lock the portfolio, verify tenant equality, read current inputs, run the comparator and atomically upsert the report.'],
    ['FitGap::Comparison', 'Pure Ruby rules: ID/label matching, strict levels, override precedence, null reasons and signed delta.'],
    ['Persistence / export', 'Existing unique index prevents duplicate report rows. JSON and PDF use current comparisons; PDF embeds a licensed Unicode font.'],
], [126, WIDTH-126])
add('Designed failure paths', 'h2')
table(['Condition', 'Behavior'], [
    ['Missing / invalid / ambiguous rating', 'not_assessed, null level and delta, explicit reason and follow-up guidance.'],
    ['Repeated or legacy generation jobs', 'Same deterministic upsert under a portfolio row lock; no new provider request.'],
    ['Database failure during refresh', 'Transaction preserves the previous report. Override plus dependent refresh rolls back together.'],
    ['API/network failure', 'Visible explanation and retry action; no silent blank report or automatic requeue loop.'],
    ['Export failure', 'Keep the comparison visible, show an error, and re-enable export.'],
    ['Provider timeout/model error', 'No provider call exists in this selected Fit/Gap path. Upstream portfolio failures remain outside this slice.'],
], [154, WIDTH-154])
add('Maintainability and rollback', 'h2')
add('The comparator can be tested without Rails. No new reporting schema is required. Deploy API and web together; the comparison metadata is additive, while removal of unsupported culture prose is an intentional product behavior change. Existing narrative columns and the legacy worker entry point remain, allowing a code rollback without a data-destructive down migration.')

newpage()
heading('Step 5', 'Verification, seeded fault, and AI review')
table(['Executed check', 'Result / evidence'], [
    ['Rails + PostgreSQL', str(results['api']['tests']) + ' examples passed. Includes auth/tenant isolation, current comparisons, empty data, override behavior, rollback and PDF/JSON export.'],
    ['React unit tests', str(results['web_unit']['tests']) + ' tests passed for the contract, uncertainty, filtering, loading, errors/retry and export recovery.'],
    ['Browser contract tests', str(results['browser']['tests']) + ' tests passed. Real React/browser with synthetic API fixtures; four widths (320/390/768/1280), long text, keyboard, empty, error and export controls.'],
    ['Production web build', 'TypeScript and Vite build passed. This is build evidence, not a claim about live Gemini transport.'],
    ['Running application demo', 'Browser uses the real local Rails API with synthetic PostgreSQL records. Shows a human override, current exports, mobile review, simulated network failure/retry and empty configuration.'],
], [145, WIDTH-145])
add('Seeded fault proof', 'h2')
add('On scratch branch codex/seeded-fault-proof, commit a1bae27 deliberately changed candidate - expected into expected - candidate. The same 25 comparator examples produced 2 failures. Revert 79e06aa restored 25 passing examples. The fault and revert were fast-forwarded into the feature branch, preserving visible history. No assertions were removed or weakened.')
add('AI verification moment', 'h2')
add('The initial AI-authored tenant patch scoped by current_tenant_id but did not bind that resolved tenant to authenticated JWT claims. Review found the pre-authentication header fallback. Added verify_authenticated_tenant! and a request regression test that rejects a signed token without a scheme even when a header selects a tenant. This is an actual correction of generated code, not a fabricated model incident.')
add('Evidence distinctions', 'h2')
add('Mocked frontend/browser tests do not prove database authorization or transaction safety; separate Rails/PostgreSQL specs do. The demonstration uses actual API requests, except for the explicitly simulated network failure. No live-audio interview, fairness study, performance benchmark or real-user usability study is claimed.')

newpage()
heading('Step 5 / visual evidence', 'Before: required levels disappear')
screenshot('baseline.png', max_height=545)
add('Baseline React report reading the actual API-shaped response. The Required cells are blank because the component reads required_level while the API sends expected_level. The old summary also omits unassessed skills. All displayed records are synthetic.', 'small')
add('The baseline UI is served from main-branch source with a separate local dependency cache. The screenshot is a reproduction of the contract mismatch, not a production incident.', 'small')

newpage()
heading('Step 5 / visual evidence', 'After: uncertainty and human provenance')
screenshot('desktop-override.png', max_height=575)
add('The running Rails API provides current required and assessed levels, assessor override provenance, AI confidence, and an explicit unassessed requirement. Coverage is shown separately from the comparison outcome; it is not a fit percentage.', 'small')

newpage()
heading('Step 5 / visual evidence', 'A readable mobile review')
mobile = Image(str(ROOT / 'evidence/screenshots/mobile.png'))
ratio = min(260 / mobile.imageWidth, 565 / mobile.imageHeight)
mobile.drawWidth = mobile.imageWidth * ratio
mobile.drawHeight = mobile.imageHeight * ratio
visuals = Table([[mobile, [p('The comparison reflows', 'h2'), p('At 390px, each requirement becomes a stacked row. Required and assessed levels, source, confidence and the result remain visible. Long labels wrap without horizontal page scrolling.'), p('The header keeps navigation, active tenant and logout available. Review controls have large touch targets and visible keyboard focus.'), p('Automated browser checks also exercise 320px, 768px and 1280px viewports with long unbroken labels.', 'small')]]], colWidths=[280, WIDTH-280])
visuals.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0)]))
story.append(visuals)

newpage()
heading('Step 5 / visual evidence', 'Designed recovery and empty states')
screenshot('error.png', max_height=270)
add('A deliberately aborted comparison request reveals a retry action. Removing the simulated failure restores the report without queueing a job. The video shows this recovery against the running Rails API.', 'small')
story.append(Spacer(1, 14))
add('Empty configuration', 'h2')
screenshot('empty.png', max_height=180)
add('A vacancy with no requirements returns an empty comparison and a clear instruction to configure the vacancy. It does not imply a candidate match. The video includes this state; browser tests also check long unbroken labels across four viewport widths.')
add('Typography, borders and the existing teal identity are retained. Buttons remain keyboard-operable; report controls have large touch targets and visible focus. No decorative statistics, testimonials or additional navigation destinations were invented.', 'small')

newpage()
heading('Step 6', 'Submission and review handoff')
add('Required submission artifacts', 'h2')
add('1. <link href="' + escape(links['pull_request']) + '"><u>GitHub Pull Request</u></link>: fullstack implementation, tests, workflow, decision documents and visible seeded-fault history.')
add('2. <link href="' + escape(links['video']) + '"><u>3-minute video walkthrough</u></link>: synthetic data, real local API requests, and captioned explanations of the chosen product behavior.')
add('3. This single PDF: execution narrative, ranked findings, acceptance criteria, option comparison, engineering proof, screenshots and constraints.')
add('Privacy and data handling', 'h2')
add('The implemented boundary requires authenticated role/tenant checks and ownership-constrained queries. Artifacts use synthetic data. Local development tokens and fixture connection material stay in ignored files; no real interview transcripts or provider keys are committed. No new model request sends candidate data from this comparison workflow.')
add('The broader deployment still needs explicit decisions about legal basis, notices, retention, data-subject requests and provider transfers. This bounded engineering change is not an application-wide compliance certification.')
add('What remains outside this submission', 'h2')
add('Upstream portfolio generation validation/atomicity, live voice/Gemini transport, application-wide tenant audit, production load testing, and direct user validation. The deadline printed in the brief has no year; reconcile it with the hiring portal before uploading.')
add('Sources', 'h2')
for label, url in [
    ('Baseline repository and service documentation', 'https://github.com/rakamindev/ai-interview-platform'),
    ('Product wiki PRD 01 and PRD 02', 'https://github.com/rakamindev/ai-interview-platform/wiki'),
    ('OPM: Structured Interviews (rating-scale principle only)', 'https://www.opm.gov/policy-data-oversight/assessment-and-selection/structured-interviews/'),
]:
    add('<link href="' + escape(url) + '"><u>' + escape(label) + '</u></link>', 'small')
add('Also consulted: the supplied four-page case-study brief. OPM guidance is a methodological reference, not Indonesian regulation. Product/persona observations are reasoned hypotheses unless identified as executed application checks.', 'small')

def furniture(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(42, 37, A4[0]-42, 37)
    canvas.setFont('Vera', 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(42, 24, 'Evidence-first Fit/Gap review | 28 October 2026')
    canvas.drawRightString(A4[0]-42, 24, str(document.page))
    canvas.restoreState()

destination = ROOT / 'output/pdf/case-study-report.pdf'
destination.parent.mkdir(parents=True, exist_ok=True)
document = SimpleDocTemplate(str(destination), pagesize=A4, rightMargin=42, leftMargin=42, topMargin=43, bottomMargin=52, title='Evidence-first Fit/Gap review', author='Fullstack case-study submission')
document.build(story, onFirstPage=furniture, onLaterPages=furniture)
print(destination)
