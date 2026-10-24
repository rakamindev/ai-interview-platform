# frozen_string_literal: true

RSpec.describe Portfolios::Generator do
  let!(:assessment) do
    Assessment.create!(tenant_id: 123, created_by: 1, name: 'Synthetic assessment',
                       time_limit_min: 30)
  end
  let!(:assessment_skill) do
    AssessmentSkill.create!(assessment: assessment, skill_id: 'SK-ENG-001', skill_label: 'React',
                            l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3',
                            l4_anchor: 'L4', l5_anchor: 'L5', expected_level: 3)
  end
  let!(:session) { Session.create!(tenant_id: 123, assessment: assessment, status: 'ended') }
  let!(:turn) do
    TranscriptTurn.create!(session: session, turn_number: 1, speaker: 'candidate',
                           text: 'I measured rerenders with the React Profiler.')
  end
  let!(:portfolio) { Portfolio.create!(session: session, generation_status: 'complete') }
  let!(:original_skill) do
    PortfolioSkill.create!(portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'React',
                           ai_level: 2, ai_confidence: 'medium', evidence: [turn.text],
                           competency_summary: 'Synthetic prior assessment')
  end

  it 'keeps the last complete portfolio when model output contains an invalid level' do
    client = instance_double(Gemini::HttpClient)
    allow(client).to receive(:generate_content).and_return(
      'configured_skills' => [{ 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React',
                                'level' => nil, 'confidence' => 'medium',
                                'evidence' => [turn.text], 'competency_summary' => 'Invalid' }],
      'discovered_skills' => []
    )

    expect { described_class.new(session: session, gemini_client: client).call }
      .to raise_error(ArgumentError, /Invalid skill level/)

    expect(portfolio.reload.generation_status).to eq('complete')
    expect(portfolio.generation_error).to eq('ArgumentError')
    expect(portfolio.portfolio_skills.pluck(:id)).to eq([original_skill.id])
  end

  it 'updates a matching skill without deleting the assessor override' do
    override = AssessorOverride.create!(portfolio_skill: original_skill, ai_level: 2,
                                        override_level: 4, assessor_notes: 'Observed stronger scope',
                                        overridden_by: 1)
    client = instance_double(Gemini::HttpClient)
    allow(client).to receive(:generate_content).and_return(
      'configured_skills' => [{ 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React',
                                'level' => 3, 'confidence' => 'high',
                                'evidence' => [turn.text], 'competency_summary' => 'Updated assessment' }],
      'discovered_skills' => []
    )

    described_class.new(session: session, gemini_client: client).call

    expect(portfolio.reload).to be_complete
    expect(portfolio.portfolio_skills.pluck(:id)).to eq([original_skill.id])
    expect(original_skill.reload.ai_level).to eq(3)
    expect(original_skill.assessor_override.id).to eq(override.id)
    expect(original_skill.assessor_override.override_level).to eq(4)
  end

  it 'keeps the last complete portfolio if a response omits an overridden skill' do
    override = AssessorOverride.create!(portfolio_skill: original_skill, ai_level: 2,
                                        override_level: 4, overridden_by: 1)
    client = instance_double(Gemini::HttpClient)
    allow(client).to receive(:generate_content).and_return(
      'configured_skills' => [], 'discovered_skills' => []
    )

    expect { described_class.new(session: session, gemini_client: client).call }
      .to raise_error(ArgumentError, /overridden skill/)

    expect(portfolio.reload).to be_complete
    expect(original_skill.reload.assessor_override.id).to eq(override.id)
    expect(original_skill.ai_level).to eq(2)
  end

  it 'does not publish an old model response after a new generation attempt starts' do
    portfolio.update!(generation_attempt_token: 'old-attempt',
                      generation_attempted_at: Time.current)
    client = instance_double(Gemini::HttpClient)
    allow(client).to receive(:generate_content) do
      portfolio.update!(generation_attempt_token: 'new-attempt')
      { 'configured_skills' => [{ 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React',
                                  'level' => 5, 'confidence' => 'high',
                                  'evidence' => [turn.text], 'competency_summary' => 'Old result' }],
        'discovered_skills' => [] }
    end

    described_class.new(session: session, gemini_client: client, request_token: 'old-attempt').call

    expect(portfolio.reload.generation_attempt_token).to eq('new-attempt')
    expect(original_skill.reload.ai_level).to eq(2)
    expect(original_skill.competency_summary).to eq('Synthetic prior assessment')
  end
end
