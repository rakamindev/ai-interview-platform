export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6 text-sm text-foreground/90 leading-relaxed">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Privacy Policy — Candidate Interview Data</h1>
        <p className="text-muted-foreground text-xs">
          Effective under Indonesia's Personal Data Protection Law (Undang-Undang Perlindungan Data Pribadi, UU PDP No. 27/2022).
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">What we collect</h2>
        <p>
          During your AI interview session we collect your name, your spoken voice (processed
          in real time, not stored as an audio file), and a text transcript of what you say.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">How it's processed</h2>
        <p>
          Your voice is streamed live to Google's Gemini AI service to conduct the interview and
          generate the transcript. This means your voice data is processed by a third-party
          provider outside Indonesia for the duration of the call. We do not store a recording of
          the audio itself — only the resulting text transcript and skill assessment are retained.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Why we process it</h2>
        <p>
          Your name and transcript are used solely to generate a skill assessment for the hiring
          team you're applying to. They are not used for any other purpose, and not sold or
          shared with anyone outside that assessment process.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Your rights</h2>
        <p>
          Under UU PDP you may request access to, correction of, or deletion of your personal
          data, and you may withdraw consent at any time before your interview starts. Contact
          the hiring team that invited you to exercise these rights.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Consent</h2>
        <p>
          Starting the interview requires your explicit consent to the processing described here.
          Declining consent means the interview cannot proceed.
        </p>
      </section>
    </div>
  );
}
