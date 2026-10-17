# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::StartHandler, type: :service do
  let(:tenant_id) { 1 }
  let(:assessment) { Current.using(tenant_id: tenant_id) { create(:assessment) } }
  let(:session) { Current.using(tenant_id: tenant_id) { create(:session, assessment: assessment) } }

  it 'refuses to activate a session without consent' do
    expect { Sessions::StartHandler.new(session).call }
      .to raise_error(Sessions::StartHandler::ConsentRequired)

    expect(session.reload.status).to eq('pending')
    expect(session.coverage_maps.count).to eq(0)
  end

  it 'activates the session when consent has been given' do
    session.grant_consent!(version: 'v1', consent_text: 'notice')

    Sessions::StartHandler.new(session).call

    expect(session.reload.status).to eq('active')
    expect(session.started_at).to be_present
  end

  it 'initializes coverage maps from assessment skills on start' do
    session.grant_consent!(version: 'v1', consent_text: 'notice')
    create(:assessment_skill, assessment: assessment, skill_label: 'React', display_order: 0)

    Sessions::StartHandler.new(session).call

    expect(session.coverage_maps.count).to eq(1)
    expect(session.coverage_maps.first.state).to eq('not_yet')
  end
end