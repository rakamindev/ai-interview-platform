# transcript-viewing Specification

## Purpose
TBD - created by archiving change authorized-pages-improvements. Update Purpose after archive.
## Requirements
### Requirement: Transcript turns show timestamps
The transcript page SHALL display each turn with its timestamp (and duration when available), matching the turn metadata the backend stores per PRD-02 (N6 `ts`).

#### Scenario: Timestamped turns rendered
- **WHEN** a transcript with turn timestamps is loaded
- **THEN** each turn displays its timestamp alongside the speaker label and text

#### Scenario: Missing timestamp
- **WHEN** a turn has no timestamp
- **THEN** the turn renders without a timestamp rather than showing an invalid value

### Requirement: Transcript filtering and search
The transcript page SHALL offer a speaker filter (AI interviewer / candidate / all) and a text search that narrows the visible turns, for evidence hunting in long sessions.

#### Scenario: Filter by speaker
- **WHEN** an assessor selects the candidate filter
- **THEN** only candidate turns are displayed

#### Scenario: Search within transcript
- **WHEN** an assessor enters a search term
- **THEN** only turns containing the term are displayed, with the term highlighted

### Requirement: Transcript anchors
The transcript page SHALL support deep links to a specific turn by turn number (e.g., `?turn=<n>`), scrolling to and highlighting that turn, so portfolio evidence quotes can resolve to it.

#### Scenario: Deep link to a turn
- **WHEN** the transcript page loads with a turn anchor in the URL
- **THEN** the page scrolls to that turn and highlights it

#### Scenario: Anchor not found
- **WHEN** the anchor references a turn number outside the transcript
- **THEN** the page renders the full transcript without scrolling

### Requirement: Transcript export with turn metadata
The transcript page SHALL export beyond plain text, offering a structured format (JSON and/or SRT) that includes turn numbers and timestamps, alongside the existing `.txt` download.

#### Scenario: Export JSON transcript
- **WHEN** an assessor exports the transcript as JSON
- **THEN** the downloaded file contains the turns with speaker, text, turn number, and timestamp

#### Scenario: Export txt transcript
- **WHEN** an assessor exports the transcript as `.txt`
- **THEN** the existing plain-text download remains available

