/**
 * Candidate-facing privacy notice (UU PDP). The same version string is sent
 * with the consent decision, so the recorded decision names the text the
 * candidate actually read.
 */
export const CONSENT_VERSION = "v1";

export interface PrivacyNoticeSection {
    heading: string;
    paragraphs?: string[];
    bullets?: string[];
}

export const PRIVACY_NOTICE: PrivacyNoticeSection[] = [
    {
        heading: "What this interview records",
        bullets: [
            "Audio of your spoken answers.",
            "A written transcript of the interview.",
            "Which skills the interview covered, and how much evidence each answer gave.",
            "Interviewer ratings derived from your answers.",
        ],
    },
    {
        heading: "Who processes it",
        paragraphs: [
            "The hiring team runs this interview platform and decides how your data is used. The platform stores your audio, transcript and results on their behalf.",
            "Google Gemini is used as a subprocessor to transcribe the conversation and to draft skill ratings. Your audio and transcript are sent to that service for this purpose only.",
        ],
    },
    {
        heading: "Why it is processed",
        paragraphs: [
            "Your data is used to run this interview, to summarise your skills against the role you applied for, and to support the hiring decision made by the hiring team.",
        ],
    },
    {
        heading: "Automated assessment",
        paragraphs: [
            "Skill ratings and the fit/gap summary are produced automatically from your interview. They are a draft: a human assessor reviews and can correct them, and no decision is made by the system alone.",
        ],
    },
    {
        heading: "Your rights",
        bullets: [
            "Ask for a copy of the data held about you.",
            "Ask for corrections to inaccurate data.",
            "Withdraw this consent at any time — including by declining here, or later by contacting the hiring team.",
        ],
    },
    {
        heading: "How long it is kept",
        paragraphs: [
            "The hiring team keeps your interview data only as long as needed for the recruitment process and the retention period they apply. Contact them to ask for the specific period.",
        ],
    },
    {
        heading: "Contact",
        paragraphs: [
            "Contact the hiring team using the invitation you received, and keep your invite link to hand so they can find your record.",
        ],
    },
];
