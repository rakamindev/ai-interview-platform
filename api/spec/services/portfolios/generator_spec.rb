# frozen_string_literal: true

require 'rails_helper'

# AC1, AC2, AC3, AC6.1-6.2: the generator only stores ratings the interview earned, contains bad
# model output per skill, writes atomically and never destroys assessor overrides.
RSpec.describe Portfolios::Generator do
  let(:org) { create(:organization) }
  let(:session) { create(:session, organization: org) }

  let!(:react) { coverage('SK-ENG-001', 'React / Frontend Development Core', 'covered', 3) }
  let!(:typescript) { coverage('SK-ENG-009', 'TypeScript & Type Systems', 'partial', 2) }
  let!(:communication) { coverage('SK-SOFT-001', 'Communication', 'not_yet', 0) }

  def coverage(skill_id, label, state, probes, discovered: false)
    create(:coverage_map, session: session, skill_id: skill_id, skill_label: label, state: state,
                          probe_count: probes, is_discovered: discovered)
  end

  def say(text, speaker: 'candidate')
    create(:transcript_turn, session: session, speaker: speaker, text: text)
  end

  def rated(skill_id, label, level: 3, confidence: 'high', evidence: ['A real quote.'], summary: 'Summary.')
    { 'skill_id' => skill_id, 'skill_label' => label, 'level' => level, 'confidence' => confidence,
      'evidence' => evidence, 'competency_summary' => summary }
  end

  def model_output(configured, discovered = [])
    { 'configured_skills' => configured, 'discovered_skills' => discovered }
  end

  def full_output
    model_output([
                   rated('SK-ENG-001', 'React / Frontend Development Core', level: 3),
                   rated('SK-ENG-009', 'TypeScript & Type Systems', level: 2),
                   rated('SK-SOFT-001', 'Communication', level: 1, summary: 'No evidence was gathered.')
                 ])
  end

  def generate(client)
    described_class.new(session: session, gemini_client: client).call
  end

  def skills_by_label(portfolio)
    portfolio.reload.portfolio_skills.index_by(&:skill_label)
  end

  context 'when the candidate never answered (AC1.2)' do
    before { say('Hi, thanks for joining. Shall we start?', speaker: 'ai') }

    it 'does not call the model and marks every skill not assessed' do
      client = FakeGeminiClient.new(full_output)
      portfolio = generate(client)

      expect(client.prompts).to be_empty
      expect(portfolio.reload.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.pluck(:assessment_status).uniq).to eq(['not_assessed'])
      expect(portfolio.portfolio_skills.pluck(:ai_level).uniq).to eq([nil])
    end
  end

  context 'when the candidate spoke but no skill was discussed' do
    before do
      [react, typescript].each { |c| c.update!(state: 'not_yet', probe_count: 0) }
      say('Sorry, my audio keeps cutting out. Can you repeat that?')
    end

    it 'does not call the model' do
      client = FakeGeminiClient.new(full_output)
      generate(client)

      expect(client.prompts).to be_empty
    end
  end

  context 'with a normal interview' do
    before { say('I keep server data in a query cache.') }

    it 'never rates a not_yet skill, whatever the model returns (AC1.1)' do
      skills = skills_by_label(generate(FakeGeminiClient.new(full_output)))

      expect(skills['Communication']).to have_attributes(assessment_status: 'not_assessed', ai_level: nil,
                                                         ai_confidence: nil, competency_summary: '')
      expect(skills['React / Frontend Development Core']).to have_attributes(assessment_status: 'assessed',
                                                                             ai_level: 3)
    end

    it 'computes confidence from coverage and survives a capitalised model label (AC3, F5)' do
      output = full_output
      output['configured_skills'][1]['confidence'] = 'High'

      skills = skills_by_label(generate(FakeGeminiClient.new(output)))

      expect(skills['TypeScript & Type Systems'].ai_confidence).to eq('medium')
      expect(skills['React / Frontend Development Core'].ai_confidence).to eq('high')
    end

    it 'matches model entries by skill_id in any case, then by label (AC2.5)' do
      output = model_output([
                              rated('sk-eng-001', 'React (renamed by the model)', level: 4),
                              rated(nil, 'typescript & type systems', level: 2)
                            ])

      skills = skills_by_label(generate(FakeGeminiClient.new(output)))

      expect(skills['React / Frontend Development Core'].ai_level).to eq(4)
      expect(skills['TypeScript & Type Systems'].ai_level).to eq(2)
    end

    it 'flags a discussed skill the model skipped as needs_review (AC2.6)' do
      output = model_output([rated('SK-ENG-001', 'React / Frontend Development Core')])

      skills = skills_by_label(generate(FakeGeminiClient.new(output)))

      expect(skills['TypeScript & Type Systems']).to have_attributes(assessment_status: 'needs_review', ai_level: nil)
    end

    it 'flags an invalid level instead of storing L1 (AC2.2)' do
      output = full_output
      output['configured_skills'][0]['level'] = nil

      skills = skills_by_label(generate(FakeGeminiClient.new(output)))

      expect(skills['React / Frontend Development Core']).to have_attributes(assessment_status: 'needs_review',
                                                                             ai_level: nil)
    end

    it 'ignores invented and duplicate skills, keeping the first occurrence (AC2.7)' do
      output = full_output
      output['configured_skills'] << rated('SK-ENG-001', 'React / Frontend Development Core', level: 1)
      output['discovered_skills'] << rated(nil, 'Kubernetes', level: 5)

      portfolio = generate(FakeGeminiClient.new(output))
      skills = skills_by_label(portfolio)

      expect(skills.keys).to contain_exactly('React / Frontend Development Core', 'TypeScript & Type Systems',
                                             'Communication')
      expect(skills['React / Frontend Development Core'].ai_level).to eq(3)
    end

    it 'stores discovered skills that exist in the coverage map' do
      coverage(nil, 'Web Accessibility', 'initiated', 1, discovered: true)
      output = full_output
      output['discovered_skills'] << rated(nil, 'Web Accessibility', level: 2)

      skill = skills_by_label(generate(FakeGeminiClient.new(output)))['Web Accessibility']

      expect(skill).to have_attributes(is_discovered: true, assessment_status: 'assessed', ai_level: 2,
                                       ai_confidence: 'low')
    end

    it 'accepts a JSON string response' do
      skills = skills_by_label(generate(FakeGeminiClient.new(full_output.to_json)))

      expect(skills['React / Frontend Development Core'].ai_level).to eq(3)
    end
  end

  context 'when the response is unreadable (AC2.8)' do
    before { say('I keep server data in a query cache.') }

    ['Sorry, I cannot help with that.', '[1, 2, 3]', ['not', 'a', 'hash']].each do |raw|
      it "raises a retryable error and writes no skills for #{raw.inspect[0, 30]}" do
        expect { generate(FakeGeminiClient.new(raw)) }.to raise_error(Portfolios::Generator::UnreadableOutput)
        expect(PortfolioSkill.count).to eq(0)
      end
    end
  end

  context 'when a portfolio already exists' do
    before { say('I keep server data in a query cache.') }

    let!(:portfolio) { create(:portfolio, session: session) }
    let!(:old_react) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001',
                               skill_label: 'React / Frontend Development Core', ai_level: 2)
    end
    let!(:old_communication) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-SOFT-001', skill_label: 'Communication',
                               ai_level: 1, ai_confidence: 'low')
    end
    let!(:override) do
      AssessorOverride.create!(portfolio_skill: old_react, ai_level: 2, override_level: 4,
                               assessor_notes: 'Stronger in the follow-up.', overridden_by: 1)
    end

    it 'updates skills in place and keeps the override (AC6.1)' do
      generate(FakeGeminiClient.new(full_output))

      expect(old_react.reload).to have_attributes(ai_level: 3, assessment_status: 'assessed')
      expect(old_react.assessor_override).to eq(override)
    end

    it 'keeps the override when the skill becomes not assessed (AC6.2)' do
      AssessorOverride.create!(portfolio_skill: old_communication, ai_level: 1, override_level: 2,
                               assessor_notes: 'Clear explanations throughout.', overridden_by: 1)

      generate(FakeGeminiClient.new(full_output))

      expect(old_communication.reload).to have_attributes(assessment_status: 'not_assessed', ai_level: nil)
      expect(old_communication.assessor_override.override_level).to eq(2)
    end

    it 'leaves every previous skill untouched when saving fails halfway (AC2.9)' do
      calls = 0
      allow_any_instance_of(PortfolioSkill).to receive(:save!).and_wrap_original do |original, *args|
        calls += 1
        raise ActiveRecord::StatementInvalid, 'simulated failure' if calls == 2

        original.call(*args)
      end

      expect { generate(FakeGeminiClient.new(full_output)) }.to raise_error(ActiveRecord::StatementInvalid)

      expect(old_react.reload.ai_level).to eq(2)
      expect(old_communication.reload.ai_level).to eq(1)
      expect(portfolio.reload.portfolio_skills.count).to eq(2)
      expect(override.reload).to be_present
    end

    it 'removes stale skills that are no longer in the coverage map, unless they carry an override' do
      stale = create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-OLD-001', skill_label: 'Old skill')
      kept = create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-OLD-002', skill_label: 'Old reviewed')
      AssessorOverride.create!(portfolio_skill: kept, ai_level: 3, override_level: 3, overridden_by: 1)

      generate(FakeGeminiClient.new(full_output))

      expect(PortfolioSkill.exists?(stale.id)).to be(false)
      expect(PortfolioSkill.exists?(kept.id)).to be(true)
    end
  end

  context 'when an attempt fails (AC7.3)' do
    before { say('I keep server data in a query cache.') }

    {
      Gemini::HttpClient::ApiError.new('API returned 503', status: 503) => 'The AI model is overloaded (HTTP 503).',
      Gemini::HttpClient::ApiError.new('API returned 404', status: 404) =>
        'The AI model is not available (HTTP 404). Check the configured model name.',
      Gemini::HttpClient::RateLimitError.new('Rate limited', status: 429) => 'The AI model is rate limited (HTTP 429).',
      Gemini::HttpClient::TimeoutError.new('timeout') => 'The AI model did not respond in time.',
      RuntimeError.new('secret internals') => 'Unexpected error (RuntimeError).'
    }.each do |error, reason|
      it "keeps the portfolio generating with a readable reason for #{error.class.name.demodulize}" do
        expect { generate(FakeGeminiClient.new(error)) }.to raise_error(error.class)

        expect(session.portfolio.reload).to have_attributes(generation_status: 'generating', generation_attempts: 1,
                                                            generation_error: reason)
      end
    end

    it 'counts attempts and records when the latest one started' do
      2.times { generate(FakeGeminiClient.new(RuntimeError.new('x'))) rescue nil }

      expect(session.portfolio.reload.generation_attempts).to eq(2)
      expect(session.portfolio.generation_started_at).to be_within(5.seconds).of(Time.current)
    end
  end

  context 'when the session has no coverage map (ended before it started)' do
    before do
      CoverageMap.where(session: session).delete_all
      create(:assessment_skill, assessment: session.assessment, skill_id: 'SK-ENG-001',
                                skill_label: 'React / Frontend Development Core')
    end

    it 'lists the assessment skills as not assessed without calling the model' do
      client = FakeGeminiClient.new(full_output)
      portfolio = generate(client)

      expect(client.prompts).to be_empty
      expect(portfolio.reload.portfolio_skills.map { |s| [s.skill_label, s.assessment_status] })
        .to eq([['React / Frontend Development Core', 'not_assessed']])
    end
  end
end
