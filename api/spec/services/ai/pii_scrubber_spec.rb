# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Ai::PiiScrubber do
  subject(:scrubber) { described_class.new }

  describe '#scrub' do
    it 'redacts email addresses' do
      expect(scrubber.scrub('Contact budi@example.com for info'))
        .to eq('Contact [redacted] for info')
    end

    it 'redacts Indonesian phone numbers' do
      expect(scrubber.scrub('Call 081234567890 or +62 812-3456-7890 now'))
        .to eq('Call [redacted] or [redacted] now')
    end

    it 'redacts 16-digit ID numbers' do
      expect(scrubber.scrub('NIK is 3273011203900001'))
        .to eq('NIK is [redacted]')
    end

    it 'leaves non-PII text untouched' do
      text = 'Candidate showed strong React architecture reasoning.'
      expect(scrubber.scrub(text)).to eq(text)
    end

    it 'handles nil input' do
      expect(scrubber.scrub(nil)).to be_nil
    end
  end

  describe '#scrub_payload' do
    it 'recursively scrubs hashes, arrays, and strings' do
      payload = {
        'name' => 'Budi Budiman',
        'contact' => 'budi@example.com',
        'evidence' => ['Called 081234567890', 'safe quote']
      }

      result = scrubber.scrub_payload(payload)

      expect(result['contact']).to eq('[redacted]')
      # Evidence quotes keep their context; only the PII token is removed.
      expect(result['evidence']).to eq(['Called [redacted]', 'safe quote'])
      expect(result['name']).to eq('Budi Budiman') # names are not auto-scrubbed by design
    end
  end
end
