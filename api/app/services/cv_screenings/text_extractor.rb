# frozen_string_literal: true

require 'pdf-reader'
require 'zip'
require 'nokogiri'

module CvScreenings
  # Extracts plain text from an uploaded CV file (an ActiveStorage attachment).
  # #call never raises for a problem this class actually recognizes and can name
  # (PDF::Reader's/Zip's own exception classes, handled locally in extract_pdf /
  # extract_docx below) — one genuinely bad CV must not abort a batch. Anything
  # ELSE — a storage-layer failure, or any other error this class doesn't have a
  # principled basis to call "the file is bad" — propagates instead. In
  # production, entries that hit real, deterministic file problems were observed
  # to ALSO occasionally raise bare, unnamed errors (e.g. a plain ArgumentError
  # from deep inside pdf-reader) that never reproduced on a retry against the
  # exact same stored bytes — evidence they were transient, not the file's
  # fault. Rather than guess at an exhaustive list of "known transient" exception
  # classes, only the parser's own well-understood exceptions are trusted to mean
  # "this file is genuinely unreadable" — everything else propagates to
  # CvScreeningProcessEntryWorker's `rescue StandardError => e; raise`, letting
  # Sidekiq's own configured retries (and, if those are exhausted, its
  # `sidekiq_retries_exhausted` handler — which already lands the entry on
  # needs_review, never a rejection) be the actual safety net.
  class TextExtractor
    # Raised when the downloaded byte count doesn't match what was recorded at
    # upload time — unambiguous evidence of a truncated/interrupted read, not a
    # genuinely bad file. Deliberately NOT rescued into :parse_failed (see #call)
    # so it propagates to the worker and lets Sidekiq's own retry handle it,
    # instead of a transient storage hiccup permanently masquerading as a corrupt
    # CV on the very first attempt.
    class IncompleteDownloadError < StandardError; end

    MAX_BYTES = 10.megabytes
    MAX_PAGES = 20
    MAX_CHARS_FOR_GEMINI = 20_000

    DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    # Marcel sniffs a legacy .doc (OLE2 Compound File) as either the specific
    # 'application/msword' or the more generic 'application/x-ole-storage',
    # depending on what embedded structure it can identify beyond the magic bytes
    # — both mean "legacy .doc," so both route here regardless of extension.
    LEGACY_DOC_TYPES = ['application/msword', 'application/x-ole-storage'].freeze

    # status: :ok | :empty_text | :parse_failed
    # reason: nil (when :ok) or one of :encrypted, :corrupt, :too_large,
    #         :unsupported_type, :legacy_doc, :zero_byte, :no_text_layer
    # char_count is measured on the scrubbed text BEFORE truncation for Gemini.
    Result = Data.define(:status, :reason, :text, :char_count) do
      def ok? = status == :ok
    end

    def initialize(attachment)
      @attachment = attachment
    end

    def call
      return failed(:zero_byte) if @attachment.byte_size.zero?
      return failed(:too_large) if @attachment.byte_size > MAX_BYTES

      bytes = @attachment.download
      if bytes.bytesize != @attachment.byte_size
        raise IncompleteDownloadError, "expected #{@attachment.byte_size} bytes, got #{bytes.bytesize}"
      end

      content_type = sniff_content_type(bytes)

      if content_type == 'application/pdf'
        extract_pdf(bytes)
      elsif content_type == DOCX_TYPE
        extract_docx(bytes)
      elsif LEGACY_DOC_TYPES.include?(content_type)
        failed(:legacy_doc)
      else
        failed(:unsupported_type)
      end
    rescue StandardError => e
      # Reached only for an error extract_pdf/extract_docx didn't already
      # recognize and convert to a safe Result themselves (see those methods'
      # own local rescues) — a storage failure, or anything else unnamed. Log
      # and re-raise rather than guessing this means "the file is corrupt";
      # DecisionEngine has no rescue of its own, so this propagates straight to
      # the worker's retry-then-safely-land-on-needs_review handling.
      Rails.logger.error("[CvScreenings::TextExtractor] unexpected error, letting Sidekiq retry: #{e.class}: #{e.message}")
      raise
    end

    private

    def sniff_content_type(bytes)
      Marcel::MimeType.for(StringIO.new(bytes), name: @attachment.filename.to_s)
    end

    def extract_pdf(bytes)
      reader = PDF::Reader.new(StringIO.new(bytes))
      return failed(:too_large) if reader.page_count > MAX_PAGES

      finalize(reader.pages.map(&:text).join("\n"))
    rescue PDF::Reader::EncryptedPDFError
      failed(:encrypted)
    rescue PDF::Reader::MalformedPDFError, PDF::Reader::UnsupportedFeatureError
      failed(:corrupt)
    end

    def extract_docx(bytes)
      # Zip::File.open_buffer's block return value isn't reliably the method's
      # own return value (it's write-buffer plumbing under the hood) — capture
      # the result explicitly instead of relying on it.
      result = failed(:corrupt)

      Zip::File.open_buffer(bytes) do |zip|
        document = zip.glob('word/document.xml').first
        next unless document

        xml = Nokogiri::XML(document.get_input_stream.read)
        text = xml.xpath('//w:t', 'w' => 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
                  .map(&:text).join(' ')
        result = finalize(text)
      end

      result
    rescue Zip::Error
      failed(:corrupt)
    end

    def finalize(raw_text)
      scrubbed = raw_text.to_s.scrub.strip
      char_count = scrubbed.length

      if scrubbed.blank?
        Result.new(status: :empty_text, reason: :no_text_layer, text: nil, char_count: char_count)
      else
        Result.new(status: :ok, reason: nil, text: scrubbed[0...MAX_CHARS_FOR_GEMINI], char_count: char_count)
      end
    end

    def failed(reason)
      Result.new(status: :parse_failed, reason: reason, text: nil, char_count: 0)
    end
  end
end
