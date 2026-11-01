# frozen_string_literal: true

class PiiAnonymizerService
  EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  PHONE_REGEX = /(\+62|62|0)8[1-9][0-9]{7,10}/
  NIK_REGEX = /\b[0-9]{16}\b/

  def self.anonymize_text(text)
    return text if text.blank?

    anonymized = text.dup
    anonymized.gsub!(EMAIL_REGEX, '[ANONYMIZED_EMAIL]')
    anonymized.gsub!(PHONE_REGEX, '[ANONYMIZED_PHONE]')
    anonymized.gsub!(NIK_REGEX, '[ANONYMIZED_NIK]')
    anonymized
  end
end
