# frozen_string_literal: true

module CvScreenings
  # Finds the candidate's own email in extracted CV text — preferring the header
  # block (top of document), since a referee's email further down the page is a
  # common false positive. Returns nil, not a guess, whenever ambiguous: silently
  # emailing a referee instead of the candidate is a PDP incident.
  class EmailDetector
    # NOT URI::MailTo::EMAIL_REGEXP — that pattern is anchored (\A...\z) and only
    # validates that an ENTIRE string is one email address (form-validation use
    # case, e.g. User's own email format validator). It never matches a substring
    # within free-form CV text, which is what #scan needs here.
    EMAIL_REGEX = /[a-zA-Z0-9.+_-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/
    HEADER_LINE_COUNT = 8

    Result = Data.define(:email, :multiple_found)

    def initialize(text)
      @text = text.to_s
    end

    def call
      header_matches = header_text.scan(EMAIL_REGEX).uniq

      return Result.new(email: header_matches.first, multiple_found: false) if header_matches.size == 1
      return Result.new(email: nil, multiple_found: true) if header_matches.size > 1

      whole_document_matches = @text.scan(EMAIL_REGEX).uniq

      case whole_document_matches.size
      when 1 then Result.new(email: whole_document_matches.first, multiple_found: false)
      when 0 then Result.new(email: nil, multiple_found: false)
      else        Result.new(email: nil, multiple_found: true)
      end
    end

    private

    def header_text
      @text.lines.first(HEADER_LINE_COUNT).join
    end
  end
end
