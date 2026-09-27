# AI Interview Platform

An adaptive, real-time voice-to-voice conversational skills assessor evaluating technical candidates for the Indonesian hiring ecosystem.

## Language

**Hardware Check**:
The pre-interview onboarding step that verifies candidate microphone access, audio input levels, and connection latency before starting a session.
_Avoid_: Device test, system test, pre-flight check

**Pre-Flight Consent Modal**:
The mandatory, unobstructed disclosure modal presented before the hardware check where candidates provide explicit affirmative opt-in under Indonesian UU PDP No. 27/2022.
_Avoid_: Cookie banner, terms checkbox, disclaimer pop-up

**UU PDP Consent**:
The explicit affirmative opt-in confirmation required under Indonesian Law No. 27/2022 before capturing and streaming candidate biometric voice data.
_Avoid_: Terms acceptance, cookie consent, disclaimer

**Advisory Connectivity Check**:
A latency and jitter verification mechanism that measures connection health against internal API endpoints and allows a candidate bypass rather than enforcing an absolute bandwidth lockout.
_Avoid_: Speed test, bandwidth gate, network blocker

**Soft Bypass**:
An explicit candidate confirmation option enabling a candidate with fair or poor connection metrics to proceed with the interview at their own discretion.
_Avoid_: Hard skip, error ignore, override hack

**Dual-Layer Invite Resolution**:
The URL routing architecture where `invite_url` generates frontend links (`WEB_BASE_URL`) while the API host preserves a redirect fallback to prevent 404 errors.
_Avoid_: Hardcoded host, link redirector

**Code-Switching**:
The bilingual technical dialogue mode mixing Indonesian conversational syntax with English engineering terminology (*Bahasa Jaksel*).
_Avoid_: Language mixing, slang, bilingual translation

**Decision-Support Dossier**:
The post-session evaluation portfolio and Fit/Gap analysis reserved exclusively for human assessor review, preventing automated hiring decisions.
_Avoid_: Automated scorecard, pass/fail result, candidate grade

**Dual-Mode Skill Keying**:
The taxonomy matching strategy using canonical `skill_id` for standardized B7 competencies while allowing case-insensitive `skill_label` fallback for custom unmapped skills.
_Avoid_: String-only matching, label fuzzy match, ID-only constraint

**Session Resumption Token**:
The Gemini Live session resumption token persisted during network interruptions to resume real-time dialogue without restarting the candidate's interview.
_Avoid_: Reconnect cookie, socket cache, session restart

**Coordinated Dual-Gating**:
The acoustic echo management strategy combining client-side mute during AI speech with a server-side audio firewall delayed by a buffer drain interval.
_Avoid_: Software mute, half-duplex hack, mute toggle

**Evidence-Gated Promotion**:
The policy that coverage states advance to covered strictly when Gemini observes candidate proof, eliminating unearned auto-promotion based on probe counts.
_Avoid_: Auto-advance, probe threshold promotion, timeout promotion

**Tenant-Bound User**:
The user authenticated with a mandatory server-resolved organization binding, preventing cross-tenant scheme spoofing.
_Avoid_: Header-scoped user, dynamic tenant user

**Gated Audio-Reactive Visualizer**:
A real-time voice meter that animates speaking indicators directly from Web Audio analysis while isolating candidate monitoring behind a gain gate during software mute to prevent acoustic feedback bleed.
_Avoid_: Audio wave, sound meter, volume bar

**Talent Supply Agency Model**:
The business architecture where Rakamin acts as the talent supplier evaluating candidates on behalf of client organizations (tenants) seeking technical hires.
_Avoid_: B2C candidate portal, open job board

**Client Tenant**:
A specific client company (Organization) evaluating candidates for its open vacancies, completely query- and cryptographically-isolated from other tenant workspaces.
_Avoid_: Workspace, team, sub-account

**Super Admin**:
A platform operator from Rakamin (`role: 'admin'`) with cross-tenant privileges, unconstrained by tenant query scopes on reads while explicitly selecting client organizations during resource creation.
_Avoid_: Root user, global admin

**Tenant Admin**:
A client-side company user (`role: 'assessor'`) representing assessors, recruiters, or hiring managers, strictly scoped to manage vacancies, review candidate dossiers, and submit evaluative overrides within their organization.
_Avoid_: Client user, standard user, evaluator
