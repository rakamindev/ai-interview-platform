# frozen_string_literal: true

require 'pdf-reader'

class CvParserService
  MAX_EXTRACTED_CHARS = 10_000 # Budget ~2,500 tokens for CV context

  def self.extract_text(attachment)
    return '' unless attachment&.attached?

    attachment.open do |tempfile|
      if pdf?(attachment)
        parse_pdf(tempfile.path)
      else
        File.read(tempfile.path, encoding: 'UTF-8', invalid: :replace, undef: :replace)
      end
    end
  rescue StandardError => e
    Rails.logger.error("[CvParserService] Failed to parse CV: #{e.class}: #{e.message}")
    ''
  end

  def self.pdf?(attachment)
    content_type = attachment.content_type.to_s.downcase
    filename     = attachment.filename.to_s.downcase

    content_type.include?('pdf') || filename.end_with?('.pdf')
  end

  def self.parse_pdf(file_path)
    reader = PDF::Reader.new(file_path)
    extracted = reader.pages.map(&:text).join("\n\n")
    clean_text(extracted).truncate(MAX_EXTRACTED_CHARS)
  rescue StandardError => e
    Rails.logger.error("[CvParserService] PDF parse failed: #{e.message}")
    ''
  end

  def self.clean_text(text)
    text.to_s
        .gsub(/\r\n?/, "\n")
        .gsub(/[ \t]+/, ' ')
        .gsub(/\n{3,}/, "\n\n")
        .strip
  end
end
