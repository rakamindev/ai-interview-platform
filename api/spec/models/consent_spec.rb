# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Consent do
  it 'requires a version and a timestamp' do
    consent = Consent.new(session: create(:session))

    expect(consent).not_to be_valid
    expect(consent.errors[:version]).to be_present
    expect(consent.errors[:consented_at]).to be_present
  end

  it 'allows only one consent per session' do
    session = create(:session)
    create(:consent, session: session)

    duplicate = build(:consent, session: session)

    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:session_id]).to be_present
  end

  describe '#current?' do
    it 'is current when it matches the wording in ConsentText' do
      expect(build(:consent).current?).to be true
    end

    it 'is not current when it records older wording' do
      expect(build(:consent, :stale).current?).to be false
    end
  end

  it 'holds no personal data beyond the proof itself' do
    consent = build(:consent)

    expect(consent).not_to respond_to(:ip_address)
    expect(consent).not_to respond_to(:user_agent)
    expect(consent.attributes.keys).to match_array(
      %w[id session_id version consented_at created_at updated_at]
    )
  end
end
