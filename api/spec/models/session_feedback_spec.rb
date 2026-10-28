# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SessionFeedback, type: :model do
  let(:org) do
    Organization.find_or_create_by!(id: 1) do |o|
      o.name = 'Test Org'
      o.scheme = 'test_org'
      o.identifier = 'test_org'
      o.host = 'test.example.com'
    end
  end

  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: 1,
      name: 'Backend Engineer Assessment',
      time_limit_min: 30,
      language: 'en'
    )
  end

  let(:session) do
    Session.create!(
      tenant_id: org.id,
      assessment: assessment,
      candidate_id: 1,
      invite_token: SecureRandom.hex(16),
      status: 'ended'
    )
  end

  describe 'validations' do
    context 'when all attributes are valid' do
      it 'is valid with rating, experience tag, feedback text, and no complaint' do
        feedback = described_class.new(
          session: session,
          tenant_id: org.id,
          rating: 5,
          experience_tag: 'smooth',
          feedback_text: 'The interview flowed naturally.',
          has_complaint: false
        )
        expect(feedback).to be_valid
        expect(feedback.save).to be true
      end

      it 'is valid with complaint when complaint_text is provided' do
        feedback = described_class.new(
          session: session,
          tenant_id: org.id,
          rating: 2,
          experience_tag: 'technical_issue',
          feedback_text: 'Experienced voice lag.',
          has_complaint: true,
          complaint_text: 'Audio dropped out at turn 5 and reconnect took 2 minutes.'
        )
        expect(feedback).to be_valid
        expect(feedback.save).to be true
      end

      it 'is valid with minimal fields (rating only)' do
        feedback = described_class.new(
          session: session,
          tenant_id: org.id,
          rating: 4,
          has_complaint: false
        )
        expect(feedback).to be_valid
      end
    end

    describe 'rating validation' do
      it 'accepts boundaries 1 and 5' do
        expect(described_class.new(session: session, tenant_id: org.id, rating: 1)).to be_valid
        expect(described_class.new(session: session, tenant_id: org.id, rating: 5)).to be_valid
      end

      it 'rejects rating below 1' do
        feedback = described_class.new(session: session, tenant_id: org.id, rating: 0)
        expect(feedback).not_to be_valid
        expect(feedback.errors[:rating]).to be_present

        feedback_neg = described_class.new(session: session, tenant_id: org.id, rating: -1)
        expect(feedback_neg).not_to be_valid
      end

      it 'rejects rating above 5' do
        feedback = described_class.new(session: session, tenant_id: org.id, rating: 6)
        expect(feedback).not_to be_valid
        expect(feedback.errors[:rating]).to be_present
      end

      it 'rejects nil rating' do
        feedback = described_class.new(session: session, tenant_id: org.id, rating: nil)
        expect(feedback).not_to be_valid
        expect(feedback.errors[:rating]).to be_present
      end
    end

    describe 'experience_tag validation and normalization' do
      it 'accepts all valid EXPERIENCE_TAGS' do
        SessionFeedback::EXPERIENCE_TAGS.each do |tag|
          feedback = described_class.new(session: session, tenant_id: org.id, rating: 4, experience_tag: tag)
          expect(feedback).to be_valid
        end
      end

      it 'rejects unrecognized experience tag' do
        feedback = described_class.new(session: session, tenant_id: org.id, rating: 4, experience_tag: 'invalid_tag')
        expect(feedback).not_to be_valid
        expect(feedback.errors[:experience_tag]).to be_present
      end

      it 'normalizes blank string to nil' do
        feedback = described_class.new(session: session, tenant_id: org.id, rating: 4, experience_tag: '')
        expect(feedback).to be_valid
        feedback.valid?
        expect(feedback.experience_tag).to be_nil
      end
    end

    describe 'complaint validations and normalization' do
      it 'fails validation when has_complaint is true but complaint_text is missing' do
        feedback = described_class.new(
          session: session,
          tenant_id: org.id,
          rating: 1,
          has_complaint: true,
          complaint_text: nil
        )
        expect(feedback).not_to be_valid
        expect(feedback.errors[:complaint_text]).to be_present
      end

      it 'fails validation when complaint_text is only whitespace' do
        feedback = described_class.new(
          session: session,
          tenant_id: org.id,
          rating: 1,
          has_complaint: true,
          complaint_text: "   \t\n  "
        )
        expect(feedback).not_to be_valid
        expect(feedback.errors[:complaint_text]).to be_present
      end

      it 'clears complaint_text if has_complaint is false' do
        feedback = described_class.create!(
          session: session,
          tenant_id: org.id,
          rating: 4,
          has_complaint: false,
          complaint_text: 'Ghost complaint text'
        )
        expect(feedback.complaint_text).to be_nil
      end
    end

    describe 'uniqueness per session' do
      it 'prevents duplicate feedback for the same session' do
        described_class.create!(
          session: session,
          tenant_id: org.id,
          rating: 5,
          has_complaint: false
        )

        duplicate = described_class.new(
          session: session,
          tenant_id: org.id,
          rating: 3,
          has_complaint: false
        )
        expect(duplicate).not_to be_valid
        expect(duplicate.errors[:session_id]).to be_present
      end
    end
  end
end
