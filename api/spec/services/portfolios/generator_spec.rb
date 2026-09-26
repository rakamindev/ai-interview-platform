# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:session) { create(:session) }
  let(:gemini) { instance_double(Gemini::HttpClient) }
  let(:react_rated) { { 'configured_skills' => [{ 'skill_label' => 'React', 'level' => 3 }] } }

  before do
    create(:transcript_turn, session: session, speaker: 'ai', text: 'Tell me about a slow page you fixed.')
    create(:transcript_turn, session: session, speaker: 'candidate', text: 'I measured it first, then split the list.')
  end

  def generator(for_session = session)
    described_class.new(session: for_session, gemini_client: gemini)
  end

  def generate(answer)
    allow(gemini).to receive(:generate_content).and_return(answer)
    generator.call
  end

  describe 'what it saves' do
    it 'saves a skill the interview never reached as not assessed, not as L1' do
      create(:coverage_map, session: session, skill_label: 'React', state: 'covered', probe_count: 3)
      create(:coverage_map, session: session, skill_label: 'Leadership & Ownership', state: 'not_yet', probe_count: 0)

      portfolio = generate('configured_skills' => [
        { 'skill_label' => 'React', 'level' => 3, 'competency_summary' => 'Measures before fixing.' },
        { 'skill_label' => 'Leadership & Ownership', 'level' => 1, 'competency_summary' => 'Not evaluated.' }
      ])

      skills = portfolio.portfolio_skills.index_by(&:skill_label)
      expect(skills['React']).to have_attributes(status: 'assessed', ai_level: 3, ai_confidence: 'high')
      expect(skills['Leadership & Ownership']).to have_attributes(status: 'not_assessed', ai_level: nil,
                                                                  competency_summary: nil)
      expect(portfolio.reload.generation_status).to eq('complete')
    end

    it 'never turns an odd level into a number' do
      create(:coverage_map, session: session, skill_label: 'React')

      skill = generate('configured_skills' => [{ 'skill_label' => 'React', 'level' => 'strong' }])
              .portfolio_skills.first

      expect(skill).to have_attributes(status: 'unavailable', ai_level: nil, raw_level: '"strong"')
    end

    it 'still reports a configured skill the model left out' do
      create(:coverage_map, session: session, skill_label: 'React')
      create(:coverage_map, session: session, skill_label: 'Testing')

      portfolio = generate(react_rated)

      expect(portfolio.portfolio_skills.find_by(skill_label: 'Testing'))
        .to have_attributes(status: 'unavailable', ai_level: nil)
    end

    it 'clears the failure left by an earlier try once it succeeds' do
      create(:coverage_map, session: session, skill_label: 'React')
      create(:portfolio, session: session, generation_status: 'pending', failure_kind: 'model_unavailable',
                         generation_error: 'API returned 503')

      portfolio = generate(react_rated)

      expect(portfolio.reload).to have_attributes(generation_status: 'complete', failure_kind: nil,
                                                  generation_error: nil)
    end
  end

  describe 'running once' do
    it 'does nothing while another job is working on the report' do
      create(:portfolio, session: session, generation_status: 'generating')

      expect(gemini).not_to receive(:generate_content)
      expect(generator.call.reload.generation_status).to eq('generating')
    end

    it 'does nothing for a report that is already complete' do
      create(:portfolio, session: session, generation_status: 'complete')

      expect(gemini).not_to receive(:generate_content)
      expect(generator.call.reload.generation_status).to eq('complete')
    end

    it 'takes over a report whose job stopped more than 5 minutes ago' do
      create(:coverage_map, session: session, skill_label: 'React')
      create(:portfolio, session: session, generation_status: 'generating')
        .update_column(:status_changed_at, 6.minutes.ago)

      expect(generate(react_rated).reload.generation_status).to eq('complete')
    end
  end

  describe 'an interview with no transcript' do
    let(:silent_session) { create(:session) }

    it 'fails at once as no interview data, without asking the AI and without a retry' do
      expect(gemini).not_to receive(:generate_content)

      portfolio = nil
      expect { portfolio = generator(silent_session).call }.not_to raise_error
      expect(portfolio.reload).to have_attributes(generation_status: 'failed', failure_kind: 'no_interview_data')
    end
  end

  describe 'when something goes wrong' do
    before { create(:coverage_map, session: session, skill_label: 'React') }

    {
      Gemini::HttpClient::TimeoutError.new('timeout')                       => 'model_unavailable',
      Gemini::HttpClient::RateLimitError.new('Rate limited', status: 429)   => 'model_unavailable',
      Gemini::HttpClient::ApiError.new('API returned 404', status: 404)     => 'model_unavailable',
      Gemini::HttpClient::ApiError.new('API returned 503', status: 503)     => 'model_unavailable',
      Gemini::HttpClient::EmptyResponseError.new('No content')              => 'model_response_invalid'
    }.each do |error, kind|
      it "records #{error.class.name.demodulize} as #{kind} and waits for the next try" do
        allow(gemini).to receive(:generate_content).and_raise(error)

        expect { generator.call }.to raise_error(error.class)
        expect(session.portfolio.reload).to have_attributes(generation_status: 'pending', failure_kind: kind)
      end
    end

    it 'records an answer that is not JSON as model_response_invalid' do
      expect { generate('Sorry, I cannot help with that.') }.to raise_error(JSON::ParserError)
      expect(session.portfolio.reload.failure_kind).to eq('model_response_invalid')
    end

    it 'records an answer without a list of skills as model_response_invalid' do
      expect { generate('skills' => []) }.to raise_error(Portfolios::SkillResolver::InvalidAnswer)
      expect(session.portfolio.reload.failure_kind).to eq('model_response_invalid')
    end

    it 'gives an error on our side no kind, since it is not the AI and not missing data' do
      allow(gemini).to receive(:generate_content).and_raise(NoMethodError, 'a bug')

      expect { generator.call }.to raise_error(NoMethodError)
      expect(session.portfolio.reload).to have_attributes(generation_status: 'pending', failure_kind: nil)
    end

    it 'keeps the previous skills when saving fails half way' do
      create(:coverage_map, session: session, skill_label: 'Testing')
      portfolio = create(:portfolio, session: session, generation_status: 'failed')
      old_skill = create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 2)

      saves = 0
      allow_any_instance_of(PortfolioSkill).to receive(:save!).and_wrap_original do |original, *args, **options|
        saves += 1
        raise ActiveRecord::StatementInvalid, 'the database went away' if saves == 2

        original.call(*args, **options)
      end

      expect do
        generate('configured_skills' => [{ 'skill_label' => 'React', 'level' => 3 },
                                         { 'skill_label' => 'Testing', 'level' => 4 }])
      end.to raise_error(ActiveRecord::StatementInvalid)
      expect(portfolio.reload.portfolio_skills).to eq([old_skill])
      expect(portfolio.generation_status).to eq('pending')
    end
  end
end
