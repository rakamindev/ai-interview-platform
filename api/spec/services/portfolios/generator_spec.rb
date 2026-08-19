# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:session) { create(:session, tenant_id: 1) }
  let(:response) do
    {
      'configured_skills' => [
        {
          'skill_label'        => 'React',
          'level'              => 3,
          'confidence'         => 'high',
          'evidence'           => ['a revealing quote'],
          'competency_summary' => 'Solid, evidence-backed.',
        },
      ],
      'discovered_skills' => [],
    }
  end
  let(:client) { instance_double(Gemini::HttpClient) }

  before { allow(client).to receive(:generate_content).and_return(response) }

  it 'generates skills once and no-ops on an already-complete portfolio' do
    Current.using(tenant_id: 1) do
      described_class.new(session: session, gemini_client: client).call
    end

    portfolio = Portfolio.find_by(session_id: session.id)
    expect(portfolio.generation_status).to eq('complete')
    expect(portfolio.portfolio_skills.pluck(:skill_label)).to eq(['React'])

    # A duplicate/concurrent job on a complete portfolio must be a no-op.
    Current.using(tenant_id: 1) do
      described_class.new(session: session, gemini_client: client).call
    end

    expect(client).to have_received(:generate_content).once
    expect(portfolio.reload.portfolio_skills.count).to eq(1)
  end
end
