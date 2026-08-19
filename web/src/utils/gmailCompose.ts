export function openGmailCompose({ to, subject, body }: { to: string; subject: string; body: string }) {
  const params = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank");
}

function formatDeadline(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function buildCandidateInviteEmail({
  candidateName,
  roleTitle,
  timeLimitMin,
  expiresAt,
  inviteUrl,
}: {
  candidateName?: string;
  roleTitle: string;
  timeLimitMin?: number;
  expiresAt?: string;
  inviteUrl: string;
}) {
  const greeting = candidateName ? `Hi ${candidateName},` : "Hi,";
  const deadline = formatDeadline(expiresAt);

  const lines = [
    greeting,
    "",
    `You've been invited to an AI-led interview for the ${roleTitle} position.`,
    "",
    "Interview details:",
    `- Role: ${roleTitle}`,
    timeLimitMin ? `- Duration: about ${timeLimitMin} minutes` : null,
    `- Link expires: ${deadline ?? "no expiration set on this link"}`,
    "",
    "Click the link below whenever you're ready to begin:",
    inviteUrl,
    "",
    "Please make sure you're in a quiet place with a stable internet connection before starting.",
    "",
    "Good luck!",
  ].filter((line): line is string => line !== null);

  return {
    subject: `You're invited to interview for ${roleTitle}`,
    body: lines.join("\n"),
  };
}

export function buildAdminInviteEmail({
  role,
  expiresAt,
  inviteUrl,
}: {
  role: string;
  expiresAt?: string;
  inviteUrl: string;
}) {
  const deadline = formatDeadline(expiresAt);

  const lines = [
    "Hi,",
    "",
    `You've been invited to join Rakamin AI Interview as a${role === "admin" ? "n" : ""} ${role}.`,
    "",
    "Click the link below to set up your password and activate your account:",
    inviteUrl,
    "",
    deadline ? `This link expires on ${deadline} and can only be used once.` : "This link can only be used once.",
    "",
    "If you weren't expecting this invite, you can safely ignore this email.",
  ];

  return {
    subject: "You've been invited to Rakamin AI Interview",
    body: lines.join("\n"),
  };
}
