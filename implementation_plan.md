# Goal

Redesign the AI Interview Page to be highly interactive and clearly show the two sides (AI Interviewer vs Candidate). We will use a side-by-side layout on larger screens: one side dedicated to the AI Interviewer (with avatar, voice visualization, and status) and the other side for the real-time transcript/chat.

## Proposed Changes

### `web/src/pages/interview/InterviewPage.tsx`
- **Layout Redesign**: 
  - Change the main container from a single column to a responsive two-pane grid (`grid-cols-1 md:grid-cols-2` or `flex-row`).
  - **Pane 1 (Left): AI Interviewer Profile**: Display an avatar (using a generic professional icon or illustration), the `VoiceBars` visualization, and the current state ("AI is speaking...", "AI is listening...").
  - **Pane 2 (Right): Live Transcript**: A dedicated chat-like window that auto-scrolls. It will contain the `TranscriptBubble`s, giving a strong "two-sided conversation" feel.
- **Visual Enhancements**:
  - Add smooth transitions.
  - Enhance the empty state of the transcript to say "The interview will appear here...".
  - Ensure the Transcript area has a fixed height and `overflow-y-auto` so it looks like a chat box.

### `web/src/components/interview/TranscriptBubble.tsx`
- Refine styling to make the chat bubbles look more modern (e.g. improved padding, subtle shadows, rounded corners like modern chat apps).

## User Review Required
> [!IMPORTANT]
> - Do you have any specific preferences for the AI's Avatar (e.g. Robot icon, abstract gradient, or professional human silhouette)? I will use a sleek modern generic avatar by default.
> - Do you want the chat transcript to auto-scroll to the bottom every time someone speaks? (I will implement this by default).

## Verification Plan
- Start the development server.
- Review the `/interview/:token` page UI in both mobile and desktop views to ensure the two-sided layout works perfectly.
- Ensure the VoiceBars and microphone buttons still function correctly in the new layout.
