# frozen_string_literal: true

# Synthetic data to walk every fit/gap report state locally (screenshots, demo video).
# No real candidate data. Idempotent: re-running replaces the previous demo records.
#
#   bundle exec rails demo:fitgap
namespace :demo do
  desc 'Create a synthetic candidate with fit/gap reports in every state (dev only)'
  task fitgap: :environment do
    abort 'demo:fitgap is for local development only' if Rails.env.production?

    # Engine dependency stand-in: no network, deterministic narrative or failure.
    stub_client = Struct.new(:response, :error) do
      def generate_content(*, **)
        raise error if error

        response
      end
    end

    org = Organization.find_by!(scheme: 'test-corp') # created by db:seed
    tag = '[demo]'

    ActiveRecord::Base.transaction do
      Vacancy.unscoped.where(tenant_id: org.id).where('role_title LIKE ?', "#{tag}%").destroy_all
      Assessment.unscoped.where(tenant_id: org.id, name: "#{tag} Backend Engineer").find_each do |a|
        a.sessions.destroy_all
        a.destroy
      end

      assessment = Assessment.create!(tenant_id: org.id, created_by: 1, name: "#{tag} Backend Engineer",
                                      time_limit_min: 30, language: 'id')
      session = Session.create!(tenant_id: org.id, assessment: assessment, status: 'ended',
                                candidate_name: 'Demo Candidate', ended_at: Time.current)
      portfolio = Portfolio.create!(session: session, generation_status: 'complete', generated_at: Time.current)

      skill = lambda do |label, level, confidence, discovered: false|
        PortfolioSkill.create!(portfolio: portfolio, skill_label: label, ai_level: level, ai_confidence: confidence,
                               is_discovered: discovered, competency_summary: "Synthetic summary for #{label}.")
      end
      sql = skill.call('SQL & Data Modelling', 2, 'low')
      AssessorOverride.create!(portfolio_skill: sql, ai_level: 2, override_level: 4, overridden_by: 1,
                               assessor_notes: 'Strong schema design in the live exercise.')
      skill.call('Communication', 2, 'low')
      skill.call('API Design', 4, 'high')
      skill.call('Ruby on Rails', 3, 'medium')
      skill.call('Mentoring', 3, 'medium', discovered: true)

      required = {
        'SQL & Data Modelling' => 4, 'Communication' => 3, 'API Design' => 3, 'Ruby on Rails' => 3,
        'Kubernetes & Cloud Infrastructure Operations at Scale' => 2, 'Observability' => 2
      }
      vacancy = lambda do |suffix, skills = required|
        v = Vacancy.create!(tenant_id: org.id, created_by: 1, role_title: "#{tag} Backend Engineer — #{suffix}")
        skills.each { |label, lvl| VacancySkill.create!(vacancy: v, skill_label: label, expected_level: lvl) }
        v
      end

      ai = stub_client.new({ 'culture_narrative' => 'Collaborative, explains trade-offs clearly and asks clarifying ' \
                                                      'questions before committing to a design.',
                             'overall_narrative' => 'Solid backend fundamentals; infrastructure depth was not covered.' })
      down = stub_client.new(nil, Gemini::HttpClient::TimeoutError.new('demo timeout'))

      urls = {}
      v = vacancy.call('ready (AI narrative)')
      FitGap::Engine.new(portfolio: portfolio, vacancy: v, gemini_client: ai).call
      urls['ready, AI narrative'] = v

      v = vacancy.call('ready (fallback narrative)')
      FitGap::Engine.new(portfolio: portfolio, vacancy: v, gemini_client: down).call
      urls['ready, AI unavailable'] = v

      v = vacancy.call('failed')
      FitGapReport.create!(portfolio: portfolio, vacancy: v, status: 'failed',
                           error_message: 'Report generation failed. Please try again.')
      urls['failed'] = v

      v = vacancy.call('generating')
      FitGapReport.create!(portfolio: portfolio, vacancy: v, status: 'generating')
      urls['generating'] = v

      v = vacancy.call('no required skills', {})
      FitGap::Engine.new(portfolio: portfolio, vacancy: v, gemini_client: ai).call
      urls['vacancy without skills'] = v

      # Other roles with different skill sets, so the portfolio's vacancy ranking (F18) has contrast.
      { 'Data Engineer' => { 'SQL & Data Modelling' => 4, 'Apache Spark' => 3, 'Airflow' => 3, 'Kafka' => 2 },
        'Rails Developer' => { 'Ruby on Rails' => 3, 'API Design' => 3, 'SQL & Data Modelling' => 3 } }.each do |title, skills|
        v = Vacancy.create!(tenant_id: org.id, created_by: 1, role_title: "#{tag} #{title}")
        skills.each { |label, lvl| VacancySkill.create!(vacancy: v, skill_label: label, expected_level: lvl) }
      end

      base = "/assessments/#{assessment.id}/sessions/#{session.id}/fitgap"
      puts 'Demo fit/gap reports (open with the web app running):'
      urls.each { |state, vac| puts format('  %-24s %s/%d', state, base, vac.id) }
    end
  end
end
