# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::StartHandler do
  let(:assessment) { create(:assessment, :with_skills) }
  let(:session) { create(:session, assessment: assessment) }

  subject { described_class.new(session) }

  describe '#call' do
    it 'activates the session and initializes coverage maps from assessment skills' do
      started_session = subject.call

      expect(started_session.status).to eq('active')
      expect(started_session.started_at).to be_present
      expect(started_session.coverage_maps.count).to eq(2)
      expect(started_session.coverage_maps.pluck(:state).uniq).to eq(['not_yet'])
    end
  end
end
