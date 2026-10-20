# frozen_string_literal: true

require 'spec_helper'

RSpec.describe RedactedRackLogger do
  it 'redacts invite tokens embedded in candidate route paths' do
    request = double(
      raw_request_method: 'GET',
      filtered_path: '/api/v1/sessions/secret-invite-token/candidate',
      remote_ip: '127.0.0.1'
    )
    logger = described_class.new(->(_env) { [200, {}, []] })

    message = logger.send(:started_request_message, request)

    expect(message).to include('/api/v1/sessions/[FILTERED]/candidate')
    expect(message).not_to include('secret-invite-token')
  end

  it 'filters candidate and credential fields from parameter logs' do
    filter = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters)

    filtered = filter.filter(
      token: 'secret-token',
      invite_token: 'secret-invite',
      candidate_name: 'Demo Candidate',
      text: 'candidate transcript',
      role: 'assessor'
    )

    expect(filtered).to include(
      token: '[FILTERED]', invite_token: '[FILTERED]', candidate_name: '[FILTERED]',
      text: '[FILTERED]', role: 'assessor'
    )
  end
end
