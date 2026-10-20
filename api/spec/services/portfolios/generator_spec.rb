# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Portfolios::Generator do
  let!(:tenant) { create_tenant(scheme: 'gen-a') }
  let!(:assessment) { create_assessment(tenant, name: 'Frontend') }
  let!(:session) { Session.create!(assessment: assessment, tenant_id: tenant.id) }

  let(:payload) do
    {
      'configured_skills' => [
        {
          'skill_id' => 'react', 'skill_label' => 'React', 'level' => 'L3',
          'confidence' => 'high', 'evidence' => [], 'competency_summary' => 'Ships features.'
        },
        {
          'skill_id' => 'sql', 'skill_label' => 'SQL', 'level' => 2,
          'confidence' => 'medium', 'evidence' => [], 'competency_summary' => 'Reads queries.'
        }
      ],
      'discovered_skills' => []
    }
  end

  it 'accepts "L3" and 2 as levels and stores them as integers' do
    described_class.new(session: session, gemini_client: client_returning(payload)).call

    levels = session.reload.portfolio.portfolio_skills.order(:id).pluck(:skill_label, :ai_level)
    expect(levels).to eq([['React', 3], ['SQL', 2]])
  end

  it 'fails loudly instead of silently rating L1 when a level is unparsable' do
    broken = payload.merge(
      'configured_skills' => [payload['configured_skills'].first.merge('level' => 'L6')]
    )

    expect { described_class.new(session: session, gemini_client: client_returning(broken)).call }
      .to raise_error(ArgumentError, /Invalid level "L6"/)

    expect(session.reload.portfolio.generation_status).to eq('failed')
  end

  private

  def client_returning(payload)
    instance_double(Gemini::HttpClient, generate_content: payload)
  end
end
