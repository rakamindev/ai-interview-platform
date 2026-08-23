require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:fake_gemini) { instance_double(Gemini::HttpClient) }

  let(:org)        { Organization.create!(name: 'Test', scheme: 'test', identifier: 'test', host: 'localhost') }
  let(:assessment) { Assessment.create!(tenant_id: org.id, created_by: 1, name: 'Fullstack', time_limit_min: 30) }
  let(:session)    { Session.create!(tenant_id: org.id, assessment: assessment, status: 'ended') }

  it 'stores ai_level as nil when the model returns no level for a skill' do
    allow(fake_gemini).to receive(:generate_content).and_return(
      'configured_skills' => [
        { 'skill_id' => 'sk-1', 'skill_label' => 'React', 'confidence' => 'low',
          'evidence' => [], 'competency_summary' => 'Never discussed in the interview.' }
      ],
      'discovered_skills' => []
    )

    Portfolios::Generator.new(session: session, gemini_client: fake_gemini).call

    skill = session.reload.portfolio.portfolio_skills.find_by(skill_id: 'sk-1')
    expect(skill.ai_level).to be_nil
  end
end