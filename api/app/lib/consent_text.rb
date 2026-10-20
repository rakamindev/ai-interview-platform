# frozen_string_literal: true

# The text a candidate is shown before the interview, plus the version string
# recorded alongside their consent.
#
# This module is the single source of truth. The API returns it in
# `candidate_info`, the browser renders exactly what it received, and the
# version string is stored when consent is given. That chain is what makes a
# stored consent record actually prove *which* words the candidate agreed to
# — UU PDP Pasal 24 requires the controller to be able to show that proof.
#
# If the wording changes, VERSION must change with it, because every existing
# consent record refers to the old wording and candidates have to be asked
# again (the acceptance criteria for a version bump).
module ConsentText
  # Bump this whenever anything below changes. Kept as a date so the reason is
  # readable in the database without a changelog lookup.
  VERSION = "2026-10-20-v1"

  # The three things a candidate must grasp before they can agree to anything.
  # Shown without needing to expand, because consent that has to be hunted for
  # is not informed consent (Pasal 22(4)(b)).
  SUMMARY = [
    "Your voice is sent to the AI interviewer while you speak. Under UU PDP " \
      "No. 27/2022 your voice is biometric personal data, which is treated " \
      "as sensitive.",
    "Your answers are written down, stored, and analysed by AI to " \
      "build a competency assessment for this role.",
    "Only the recruiting team for this position can read what you said and " \
      "what the model concluded from it."
  ].freeze

  # UU PDP Pasal 21(1) lists seven things a controller must disclose when
  # processing rests on consent. Six are implemented here, in the order the
  # statute uses, and a spec asserts the exact list so that a disclosure
  # dropped later fails the build rather than quietly going missing.
  #
  # (d), the retention period, is deliberately absent. No retention period has
  # been decided yet. Writing one in front of a candidate that nobody has
  # committed to honouring would be worse than saying nothing, so this is
  # carried as an open requirement — to be settled with legal review, and
  # reported as unfinished rather than as done.
  #
  # [label, text]
  DETAILS = [
    # (a) legalitas dari pemrosesan Data Pribadi
    ["Legal basis",
     "Your explicit consent, relied on under UU PDP No. 27/2022, Pasal 20(2)(a). " \
     "Consent is not the only lawful basis available, but it is the one that " \
     "applies to you here."],

    # (b) tujuan pemrosesan Data Pribadi
    ["Purpose",
     "To assess your competencies for this specific role, and to give the " \
     "hiring team evidence for their decision. Nothing else."],

    # (c) jenis dan relevansi Data Pribadi yang akan diproses
    ["Why this data is relevant to you",
     "Your spoken answers describe how you work, so they are directly relevant " \
     "to a role you applied for. Your voice is biometric data and is treated as " \
     "sensitive under Pasal 4(2)(b)."],

    # (e) rincian mengenai Informasi yang dikumpulkan
    ["What we collect",
     "The words you speak, as text. Your name. The skill levels the model " \
     "assigns, with the quotes it used as evidence. " \
     "The audio of your voice is not kept after the session."],

    # (f) jangka waktu pemrosesan Data Pribadi
    ["How long we process it",
     "During this interview session, and for as long as the hiring team is " \
     "reviewing candidates for this role."],

    # (g) hak Subjek Data Pribadi
    ["Your rights",
     "To see what we hold about you, to ask for corrections, to ask for " \
     "deletion where the law allows, and to withdraw this consent. Contact " \
     "the recruiter who invited you."]
  ].freeze

  def self.summary
    SUMMARY
  end

  def self.details
    DETAILS
  end
end
