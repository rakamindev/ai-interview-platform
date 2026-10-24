# frozen_string_literal: true

RSpec.describe 'Request log filtering' do
  it 'redacts invite credentials and candidate content in nested parameters' do
    parameters = {
      token: 'synthetic-invite-secret',
      session: { candidate_name: 'Synthetic Private Name', candidate_id: 'synthetic-private-id' },
      override: { assessor_notes: 'Synthetic private observation' },
      transcript: { text: 'Synthetic candidate answer' }
    }

    filtered = ActiveSupport::ParameterFilter
               .new(Rails.application.config.filter_parameters).filter(parameters)

    expect(filtered[:token]).to eq('[FILTERED]')
    expect(filtered[:session].values).to all(eq('[FILTERED]'))
    expect(filtered[:override][:assessor_notes]).to eq('[FILTERED]')
    expect(filtered[:transcript]).to eq('[FILTERED]')
  end
end
