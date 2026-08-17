# frozen_string_literal: true

module Ai
  # UU PDP data-minimization helper.
  # Removes/obfuscates personal identifiers from free text BEFORE it is sent to
  # an external LLM endpoint, so candidate PII never leaves the boundary unless
  # strictly needed.
  #
  # This is intentionally conservative and regex-based (no model dependency):
  # it is deterministic and unit-testable. It is NOT a claim of full legal
  # compliance — it is a concrete engineering control ("PDP as a design
  # constraint rather than a checklist").
  class PiiScrubber
    EMAIL_PATTERN    = /[\w.!#$%&'*+\/=?^`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.freeze
    PHONE_PATTERN    = /(?<!\w)(?:\+?62[\s-]?0?|0)(8[1-9]\d{0,2}(?:[\s.-]?\d{3,4}){2})\b/.freeze
    ID_NUMBER_PATTERN = /\b\d{16}\b/.freeze
    PLACEHOLDER      = '[redacted]'

    # Scrubs PII from a string. Returns the sanitized text.
    def scrub(text)
      return text if text.nil?

      text
        .gsub(EMAIL_PATTERN, PLACEHOLDER)
        .gsub(PHONE_PATTERN, PLACEHOLDER)
        .gsub(ID_NUMBER_PATTERN, PLACEHOLDER)
    end

    # Scrubs a whole payload structure (hash/array/string) in place.
    def scrub_payload(value)
      case value
      when Hash
        value.each_with_object({}) { |(k, v), acc| acc[k] = scrub_payload(v) }
      when Array
        value.map { |v| scrub_payload(v) }
      when String
        scrub(value)
      else
        value
      end
    end
  end
end