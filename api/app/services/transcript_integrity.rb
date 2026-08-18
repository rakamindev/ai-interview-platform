# frozen_string_literal: true

# N15: Verifies that a session's candidate transcript is coherent enough to
# produce a trustworthy portfolio. Guards against silent-fail grading: when the
# audio was unintelligible (noise, silence, or the STT hallucinated gibberish),
# the interview result must be marked `unverifiable` instead of being graded as
# a low (L1) portfolio with no real evidence.
class TranscriptIntegrity
  # Minimum total candidate characters considered a real attempt.
  MIN_CANDIDATE_CHARS = 120
  # Minimum fraction of "real" tokens (>=3 latin letters) a coherent
  # English interview transcript is expected to contain.
  MIN_ENGLISH_RATIO = 0.6
  # Maximum fraction of visibly non-Latin script tokens (Han, Hangul,
  # Devanagari, Arabic, Cyrillic, ...) before we treat the audio as garbage.
  MAX_NON_LATIN_RATIO = 0.2

  RESULT = Struct.new(:unverifiable, :reason, keyword_init: true) do
    def unverifiable? = !!unverifiable
    def verified?     = !unverifiable
  end

  REASON_MESSAGES = {
    too_short:    'Transcript terlalu pendek untuk dinilai',
    not_english:  'Transcript tidak cukup koheren (audio mungkin tidak terbaca)',
    noise:        'Transcript didominasi noise / bukan bahasa Inggris'
  }.freeze

  # @param session an object responding to `transcript_turns`
  def self.for_session(session)
    text = session.transcript_turns
                   .where(speaker: 'candidate')
                   .order(:turn_number)
                   .map(&:text)
                   .join(' ')
    check(text)
  end

  # @param candidate_text [String]
  def self.check(candidate_text)
    text = candidate_text.to_s.strip

    return RESULT.new(unverifiable: true, reason: :too_short) if text.length < MIN_CANDIDATE_CHARS

    tokens      = text.split(/\s+/)
    latin       = tokens.count { |t| latin_token?(t) }
    non_latin   = tokens.count { |t| non_latin_token?(t) }
    english_ratio = latin.fdiv(tokens.size)
    noise_ratio   = non_latin.fdiv(tokens.size)

    return RESULT.new(unverifiable: true, reason: :noise)       if noise_ratio > MAX_NON_LATIN_RATIO
    return RESULT.new(unverifiable: true, reason: :not_english) if english_ratio < MIN_ENGLISH_RATIO

    RESULT.new(unverifiable: false, reason: nil)
  end

  def self.latin_token?(token)
    letters = token.scan(/[A-Za-z]/).size
    letters >= 3 && !non_latin_token?(token)
  end

  def self.non_latin_token?(token)
    token.match?(/[^\p{Latin}\p{Common}\p{Number}\s]/u)
  end
end