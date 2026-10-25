require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:assessment) { create(:assessment) }
  let(:valid_attributes) do
    {
      assessment: assessment,
      status: 'pending',
      tenant_id: 1
    }
  end

  before { Current.tenant_id = 1 }

  describe 'Validations' do
    context 'Positive Cases' do
      it 'is valid with valid attributes' do
        session = Session.new(valid_attributes)
        expect(session).to be_valid
      end

      it 'allows valid end_reason when ended' do
        session = Session.new(valid_attributes.merge(status: 'ended', end_reason: 'manual_candidate'))
        expect(session).to be_valid
      end
    end

    context 'Negative Cases' do
      it 'is invalid with an unknown status' do
        session = Session.new(valid_attributes.merge(status: 'unknown'))
        expect(session).not_to be_valid
        expect(session.errors[:status]).to include('is not included in the list')
      end

      it 'is invalid with an unknown end_reason' do
        session = Session.new(valid_attributes.merge(status: 'ended', end_reason: 'unknown'))
        expect(session).not_to be_valid
        expect(session.errors[:end_reason]).to include('is not included in the list')
      end

      it 'enforces invite token presence (via callback generation)' do
        session = Session.create!(valid_attributes)
        session.invite_token = nil
        expect(session).not_to be_valid
      end
    end
  end

  describe 'Callbacks and Methods' do
    it 'generates invite_token on create' do
      session = Session.create!(valid_attributes)
      expect(session.invite_token).to be_present
    end

    it 'returns the correct invite url' do
      session = Session.create!(valid_attributes)
      expect(session.invite_url).to include(session.invite_token)
    end
    
    it 'correctly reports state via helper methods' do
      session = Session.new(valid_attributes)
      expect(session.pending?).to be true
      
      session.status = 'active'
      expect(session.active?).to be true
      
      session.status = 'ended'
      expect(session.ended?).to be true
    end
  end
end
