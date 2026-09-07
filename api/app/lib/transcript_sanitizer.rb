# frozen_string_literal: true

# Removes the internal coverage / time-tracking metadata that Gemini echoes back
# into the *output transcription* stream, so neither the candidate nor the assessor
# ever sees raw system state in the transcript.
#
# Why this exists (Step 3, Internal/Candidate P2):
# the previous implementation only stripped a JSON payload when the chunk STARTED
# with "{". Gemini regularly splits one payload across two transcription chunks, so
# the second chunk started with a bare "," and slipped through untouched — confirmed
# live in both the candidate chat bubble and the assessor Live Monitor.
#
# Two entry points:
#   TranscriptSanitizer.call(text)  -> stateless cleanup of one self-contained chunk
#   TranscriptSanitizer::Stream     -> stateful; holds back a JSON object that is not
#                                      structurally complete yet and re-joins it with
#                                      the next chunk
#
# Deliberately plain Ruby (no ActiveSupport, no Rails) so it can be unit tested
# without booting the app.
module TranscriptSanitizer
  # Keys that only ever appear in the internal payload, never in human speech.
  METADATA_KEYS = %w[
    discovered
    time_remaining_minutes
    pacing
    priority_next
    probe_count
    all_skills_covered
    wrap_up
  ].freeze

  # Safety valve: if an object never closes we must not swallow real speech forever.
  # A coverage payload is a few hundred characters at most, so this is generous for
  # a real payload and short enough that a stray "{" in speech barely delays a turn.
  MAX_PENDING_CHARS = 600

  TAGGED_BLOCK_PATTERNS = [
    %r{\[COVERAGE[_ ]MAP\][\s\S]*?\[/COVERAGE[_ ]MAP\]}m,
    /\[COVERAGE[_ ]MAP[^\]]*\]/m,
    /\[TIME[_ ]CONTROL[^\]]*\][^\n]*/m,
    /pacing=\S+\s*priority_next=\S*/m,
    /\[Start the interview[^\]]*\]/m,
    /\[SESSION RESUME\][^\n]*/m,
    /\[SISTEM\][^\n]*/m
  ].freeze

  module_function

  # Cleans one chunk. Any JSON object that is complete AND looks like internal
  # metadata is dropped, wherever it sits in the string.
  def call(text)
    return '' if text.nil?

    cleaned = text.to_s.dup
    TAGGED_BLOCK_PATTERNS.each { |pattern| cleaned = cleaned.gsub(pattern, ' ') }
    cleaned = strip_orphan_fragment(cleaned)
    cleaned = strip_metadata_objects(cleaned)
    cleaned.strip
  end

  # Splits a chunk into [emittable, held_back]. `held_back` is non-nil when an
  # object opened but never closed, meaning the rest of it is still in flight.
  def split_incomplete(text)
    return ['', nil] if text.nil?

    str = text.to_s
    cursor = 0
    while (open_idx = str.index('{', cursor))
      close_idx = matching_brace(str, open_idx)
      return [str[0...open_idx], str[open_idx..]] if close_idx.nil?

      cursor = close_idx + 1
    end
    [str, nil]
  end

  # Index of the "}" that closes the "{" at `start`, or nil if it never closes.
  # String literals are skipped so a "}" inside a quote does not fool us.
  def matching_brace(str, start)
    depth = 0
    in_string = false
    escaped = false
    idx = start

    while idx < str.length
      char = str[idx]

      if in_string
        if escaped            then escaped = false
        elsif char == '\\'    then escaped = true
        elsif char == '"'     then in_string = false
        end
      else
        case char
        when '"' then in_string = true
        when '{' then depth += 1
        when '}'
          depth -= 1
          return idx if depth.zero?
        end
      end

      idx += 1
    end

    nil
  end

  # True when a JSON-ish snippet carries at least one internal metadata key.
  def metadata?(snippet)
    METADATA_KEYS.any? { |key| snippet.include?(%("#{key}")) }
  end

  # Drops every *complete* metadata object, keeping the surrounding speech.
  def strip_metadata_objects(text)
    result = +''
    cursor = 0

    while (open_idx = text.index('{', cursor))
      close_idx = matching_brace(text, open_idx)
      break if close_idx.nil? # incomplete — Stream holds it back instead

      result << text[cursor...open_idx]
      result << text[open_idx..close_idx] unless metadata?(text[open_idx..close_idx])
      cursor = close_idx + 1
    end

    result << text[cursor..].to_s
    result
  end

  # Handles the confirmed live bug: the opening "{" was consumed by the previous
  # chunk, so this chunk begins mid-object with something like
  #   , "time_remaining_minutes": 25, "pacing": "on_track"} Baik, lanjut ya...
  def strip_orphan_fragment(text)
    close_idx = text.index('}')
    return text if close_idx.nil?

    head = text[0..close_idx]
    return text if head.include?('{')  # a complete object — handled elsewhere
    return text unless metadata?(head)

    text[(close_idx + 1)..].to_s.sub(/\A[\s\}\]]+/, '')
  end

  # Per-connection sanitizer. One instance per interview WebSocket.
  class Stream
    def initialize(max_pending: MAX_PENDING_CHARS, logger: nil)
      @pending = +''
      @max_pending = max_pending
      @logger = logger
    end

    # Returns the text that is safe to show, or "" when everything was metadata
    # or is still being buffered.
    def push(text)
      joined = @pending + text.to_s
      @pending = +''

      emittable, held_back = TranscriptSanitizer.split_incomplete(joined)

      if held_back
        if joined.length > @max_pending
          # Never hold real speech hostage to a payload that never closes.
          @logger&.warn("[TranscriptSanitizer] Dropping #{joined.length} buffered chars — object never closed")
          return TranscriptSanitizer.call(joined)
        end

        @pending = held_back
      end

      TranscriptSanitizer.call(emittable)
    end

    def pending?
      !@pending.empty?
    end
  end
end
