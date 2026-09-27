# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  before do
    @organization = Organization.create!(
      name: 'Test Org', scheme: 'test-org', identifier: 'test-org', host: 'test-org.test'
    )
    within_organization do
      assessment = Assessment.new(name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1)
      assessment.save!
      @session = Session.new(assessment: assessment, candidate_name: 'Test Candidate A',
                             status: 'active', started_at: 5.minutes.ago)
      @session.save!
    end
  end

  it 'records why the session ended in error' do
    described_class.new(@session).call(reason: 'error', failure_code: 'ai_connection_lost')

    @session.reload
    expect(@session.status).to eq('ended')
    expect(@session.end_reason).to eq('error')
    expect(@session.failure_code).to eq('ai_connection_lost')
  end

  it 'does not keep the detail of an earlier failure' do
    @session.update!(failure_code: 'assessment_invalid', failure_detail: 'duplicate skills')

    described_class.new(@session).call(reason: 'error', failure_code: 'ai_connection_lost')

    @session.reload
    expect(@session.failure_code).to eq('ai_connection_lost')
    expect(@session.failure_detail).to be_nil
  end

  it 'does not record a failure for a normal end' do
    described_class.new(@session).call(reason: 'manual_assessor')

    expect(@session.reload.failure_code).to be_nil
  end

  it 'clears the failure when an error end is upgraded to a manual end' do
    described_class.new(@session).call(reason: 'error', failure_code: 'candidate_disconnected')
    described_class.new(@session.reload).call(reason: 'manual_candidate')

    @session.reload
    expect(@session.end_reason).to eq('manual_candidate')
    expect(@session.failure_code).to be_nil
  end
end
