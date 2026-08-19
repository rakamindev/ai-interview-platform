# live-monitoring Specification

## Purpose
TBD - created by archiving change authorized-pages-improvements. Update Purpose after archive.
## Requirements
### Requirement: Time remaining display on live monitor
The live monitor SHALL show time remaining in the session alongside elapsed time, derived from the coverage map's `time_remaining_minutes` (PRD-01 §3) or the session start/time limit, and SHALL shift to a low-time visual state when the remaining time is below the assessment's warning threshold.

#### Scenario: Monitor shows remaining time
- **WHEN** a session is active and the assessor views the live monitor
- **THEN** the monitor displays both elapsed time and time remaining

#### Scenario: Low-time visual state
- **WHEN** remaining time drops below the assessment's warning threshold
- **THEN** the remaining-time display uses the low-time visual treatment

#### Scenario: Session without start time
- **WHEN** a session has no start time
- **THEN** the monitor shows no elapsed/remaining time rather than incorrect values

### Requirement: Coverage map probe detail
The live monitor coverage map SHALL render each skill's probe count and mark the priority-next skill (per PRD-01 §3 coverage map fields), so the assessor can observe interviewer behavior in real time.

#### Scenario: Probe counts rendered
- **WHEN** a coverage map with probe counts is received
- **THEN** each skill entry displays its probe count alongside its coverage state

#### Scenario: Priority-next callout
- **WHEN** the coverage map includes a priority-next skill
- **THEN** the monitor visually highlights that skill as the current priority

### Requirement: Live transcript push
The live monitor SHALL receive new transcript turns over the WebSocket as they are saved (N6), appending them to the displayed transcript, with the existing polling behavior retained as a fallback when the WebSocket is unavailable. The monitor SHALL support auto-scroll to the newest turn.

#### Scenario: WS turn received while monitoring
- **WHEN** the backend emits a transcript turn event for the monitored session
- **THEN** the monitor appends the turn to the transcript and auto-scrolls if enabled

#### Scenario: WS unavailable falls back to polling
- **WHEN** the WebSocket is not connected during an active session
- **THEN** the monitor continues appending turns via the existing polling interval

### Requirement: Candidate identity on live monitor
The live monitor header SHALL show the candidate name and role for the session being monitored (PRD-02: assessor watches a named candidate's session).

#### Scenario: Monitor shows candidate identity
- **WHEN** an assessor monitors a session with a known candidate name
- **THEN** the header displays the candidate name alongside the assessment name

#### Scenario: Candidate name unknown
- **WHEN** a session has no candidate name
- **THEN** the monitor shows a neutral placeholder rather than an empty field

