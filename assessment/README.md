# AI Interview Platform — Assessment & Interview Improvements

This document summarizes the improvements, fixes, technical decisions, and acceptance criteria implemented for the AI Interview Platform.

## Overview

The changes focus on improving the reliability of the interview workflow, preventing invalid assessment and vacancy configurations, reducing unnecessary API requests, and improving the quality of transcripts and exported results.

The main areas covered are:

* Interview recovery
* Interview pre-check reliability
* Interview URL generation
* Assessment and vacancy configuration
* API request optimization
* Database consistency
* Caching
* Transcript and PDF quality

## Pull Request

[Pull Request #101](https://github.com/rakamindev/ai-interview-platform/pull/101)

---

## Problem & Gap Analysis

### Severity Model

| Priority | Meaning                                                              |
| -------- | -------------------------------------------------------------------- |
| **P0**   | Core workflow blocked or severe data/system failure                  |
| **P1**   | Major workflow degradation or high probability of incorrect behavior |
| **P2**   | Noticeable functional or UX problem with a workaround                |
| **P3**   | Minor usability, presentation, or optimization issue                 |

### P0 — Unauthorized access

#### Problem
anyone can assess other organization data as long as the login exists

#### Ideal Condition
this shouldnt happen because this is a MAJOR security risk

#### Fix
Add user relationship to organization and trace back every request to TenantScope

---

### P0 — Interview Recovery

#### Problem

An interview can enter an error state from which the candidate cannot reliably continue.

#### Ideal Condition

The interview should have a deterministic recovery path that resets the necessary interview state without requiring engineering intervention.

#### Fix

Added an interview reset/recovery mechanism for error scenarios.

#### Impact

Reduces the probability that a transient technical failure becomes a permanently failed interview.

---

### P1 — Interview Pre-check Reliability

#### Problems

* Stale pre-check state.
* Microphone monitoring loop issues.
* Audio resources not being cleaned up correctly.
* Retry-all / all-passed flow complexity.

#### Ideal Condition

Each pre-check should represent the current environment and should be safely repeatable.

#### Fixes

* Correct stale pre-check state.
* Fix microphone monitoring lifecycle.
* Fix audio cleanup.
* Simplify the all-passed state.
* Correct retry-all behavior.
* Add internet-check bypass for supported scenarios.

#### Impact

Makes pre-checks more deterministic and reduces false failures or stuck states before the candidate reaches the actual interview.

---

### P1 — Incorrect Interview Destination

#### Problem

Interview URLs could point to the backend instead of the frontend.

#### Fix

Updated interview URL generation to point to the frontend application.

#### Impact

Prevents candidates from being sent to an invalid or unusable interview destination.

---

### P1 — Invalid Assessment Configuration

#### Problems

* The same taxonomy could be selected multiple times.
* Vacancy could be unnecessarily reselected.
* Assessment actions could be available despite vacancy state.
* Vacancy availability was not sufficiently constrained.

#### Fixes

* Prevent duplicate taxonomy selection.
* Prevent unnecessary vacancy reselection.
* Conditionally enable edit/invite actions based on vacancy status.
* Add an available-vacancy query.
* Apply the same taxonomy-selection protection to vacancy configuration.

#### Impact

Moves validation closer to the point where invalid configuration is created rather than relying exclusively on downstream validation.

---

### P2 — Stale and Unnecessary Requests

#### Problem

Opening the taxonomy selector could trigger unnecessary refetches.

#### Fix

Prevent refetching when the selector is opened if the existing data is still valid.

#### Impact

Reduces API traffic and improves perceived responsiveness.

---

### P3 — Presentation & Export Quality

The following improvements primarily improve usability and output quality:

* Mobile header responsiveness.
* Filtering on assessment and vacancy lists.
* Conditional rendering based on screen size.
* Chat-style transcript bubbles.
* Millisecond transcript timestamps.
* Candidate/company names in PDFs.
* More readable PDF filenames.

These improvements do not generally block the workflow but improve the overall product experience and usefulness of exported results.

---

## Technical Decisions & Trade-offs

### Database Refactor

#### Reason

Multiple models were maintaining their own versions of the skill taxonomy. This could result in inconsistent taxonomy values across the application.

The database was therefore refactored to reference a single source of truth for skill taxonomy.

#### Trade-off

Existing assessments and vacancies may unintentionally reference updated taxonomy criteria. This could potentially alter assessment results for existing candidates.

Potential use cases that depend on the previous taxonomy structure should therefore be reviewed carefully.

---

### Caching

#### Reason

Frequently accessed and expensive requests can benefit from caching to improve response time and reduce unnecessary computation.

#### Trade-off

Cached data can become stale if the appropriate cache invalidation is not performed after mutations.

Relevant mutations must therefore invalidate affected cached data.

---

### AI Provider Review / Fallback

#### Reason

A provider fallback mechanism would allow the application to continue operating when the primary AI provider encounters an error.

A configuration API could also make it possible to switch AI providers without requiring significant application changes.

#### Trade-off

Different AI providers may expose different APIs, request formats, capabilities, and operational procedures.

Supporting multiple providers therefore introduces additional implementation and maintenance overhead. Each provider would need to be implemented and maintained individually.

Despite the additional complexity, this could provide valuable resilience and flexibility.

---

### Rich Editor

#### Reason

A rich text editor could allow users to create more complex vacancy and assessment descriptions.

This would improve flexibility for content that requires formatting beyond plain text.

---

### Multilanguage

Multilanguage support was identified as another potential improvement area.

---

## Acceptance Criteria

The following criteria were derived from the product requirements and expected behavior.

### Vacancy

* [ ] Users can filter vacancies by status.
* [ ] Users can search vacancies.
* [ ] The same taxonomy cannot be selected twice.
* [ ] Opening the taxonomy selector does not unnecessarily refetch data.
* [ ] Vacancy status is visible.
* [ ] Vacancy counters accurately represent the current dataset.

### Assessment

* [ ] Users can filter assessments by status.
* [ ] Users can search assessments.
* [ ] Duplicate taxonomy selections are prevented.
* [ ] Vacancy selection only exposes valid/available vacancies.
* [ ] Vacancy cannot be unnecessarily reselected.
* [ ] Edit/invite actions respect vacancy state.
* [ ] Session counts are visible and accurate.

### Interview

* [ ] Pre-check results represent the current check execution.
* [ ] Failed checks can be retried without corrupting state.
* [ ] Audio resources are released correctly.
* [ ] Microphone monitoring does not create runaway loops.
* [ ] The all-passed state is deterministic.
* [ ] An interview can be reset after an unrecoverable error.
* [ ] The interview URL always points to the frontend.
* [ ] Internet validation can be bypassed when explicitly configured.

### Portfolio / Export

* [ ] Candidate identity is visible in the portfolio.
* [ ] Transcript is readable as a conversation.
* [ ] Transcript timestamps retain millisecond precision.
* [ ] PDF contains candidate and company context.
* [ ] Exported filename is human-readable.

### Backend

* [ ] Assessment-related skill records reference the intended taxonomy.
* [ ] Cached data is invalidated after relevant mutations.
* [ ] Available vacancies are selected using backend rules rather than only frontend filtering.
* [ ] Names are validated at the backend boundary.
* [ ] Session counts are available without requiring unnecessary client-side aggregation.

---

## Summary

The changes primarily target **workflow reliability and data consistency**.

The highest-priority improvements ensure that:

1. Candidates can recover from interview failures.
2. Pre-checks accurately represent the current environment.
3. Interview URLs always direct candidates to the correct application.
4. Invalid assessment and vacancy configurations are prevented.
5. Backend rules enforce availability and data integrity.
6. Unnecessary API requests are reduced.
7. Transcripts and exported documents are easier to consume.

The broader architectural improvements, particularly the database refactor and caching strategy, provide a stronger foundation but introduce trade-offs that should be monitored as the platform evolves.
