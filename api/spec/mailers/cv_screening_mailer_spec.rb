# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CvScreeningMailer do
  let(:screening) { create(:cv_screening) }
  let(:batch) { create(:cv_screening_batch, cv_screening: screening) }

  describe '#invited' do
    it "contains only fixed content plus the session's invite link — no score, no threshold" do
      session = create(:session, assessment: screening.assessment, tenant_id: screening.tenant_id)
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'invited',
                                           detected_email: 'jordan.example@test.invalid', session: session)

      mail = described_class.invited(entry)

      expect(mail.to).to eq(['jordan.example@test.invalid'])
      expect(mail.text_part.body.to_s).to include(session.invite_url)
      expect(mail.html_part.body.to_s).to include(session.invite_url)
      expect(mail.text_part.body.to_s).not_to match(/\d+%|score|threshold/i)
      expect(mail.html_part.body.to_s).not_to match(/\d+%|score|threshold/i)
    end
  end

  describe '#not_advanced' do
    it 'contains the generated feedback and nothing else — no score, threshold, or private criteria' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'not_advanced',
                                           detected_email: 'jordan.example@test.invalid',
                                           feedback_text: 'Thanks for applying — we found a closer match elsewhere.')

      mail = described_class.not_advanced(entry)

      expect(mail.to).to eq(['jordan.example@test.invalid'])
      expect(mail.text_part.body.to_s).to include('Thanks for applying')
      expect(mail.text_part.body.to_s).not_to match(/\d+%|score|threshold/i)
      expect(mail.html_part.body.to_s).not_to match(/\d+%|score|threshold/i)
    end
  end
end
