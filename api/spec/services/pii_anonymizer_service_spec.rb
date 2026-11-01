require_relative '../rails_helper'

RSpec.describe PiiAnonymizerService do
  describe '.anonymize_text' do
    it 'masks email, phone number, and NIK to comply with UU PDP' do
      raw_text = "Halo, nama saya Budi. Email: budi@gmail.com, HP: 081234567890, NIK: 3201012345678901."
      result = PiiAnonymizerService.anonymize_text(raw_text)

      expect(result).not_to include("budi@gmail.com")
      expect(result).not_to include("081234567890")
      expect(result).not_to include("3201012345678901")
      expect(result).to include("[ANONYMIZED_EMAIL]")
      expect(result).to include("[ANONYMIZED_PHONE]")
      expect(result).to include("[ANONYMIZED_NIK]")
    end
  end
end
