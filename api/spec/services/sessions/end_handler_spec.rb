# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  it 'persists a safe explanation when the interview ends with an error' do
    organization = create_organization
    assessment = create_assessment(organization)
    session = create_interview_session(assessment, status: 'active', started_at: 2.minutes.ago)
    handler = described_class.new(session)
    allow(handler).to receive(:enqueue_portfolio_generation)
    allow(handler).to receive(:publish_status_update)

    handler.call(reason: 'error', error_message: 'The AI service could not be reached.')

    session.reload
    expect(session).to have_attributes(
      status: 'ended',
      end_reason: 'error',
      error_message: 'The AI service could not be reached.'
    )
    expect(session.ended_at).to be_present
    expect(session.duration_seconds).to be_between(119, 121)
  end

  it 'uses the default safe explanation when no error detail is supplied' do
    organization = create_organization
    assessment = create_assessment(organization)
    session = create_interview_session(assessment, status: 'active', started_at: 1.minute.ago)
    handler = described_class.new(session)
    allow(handler).to receive(:enqueue_portfolio_generation)
    allow(handler).to receive(:publish_status_update)

    handler.call(reason: 'error')

    expect(session.reload.error_message).to eq(Sessions::EndHandler::DEFAULT_ERROR_MESSAGE)
  end
end
