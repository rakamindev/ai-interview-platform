# frozen_string_literal: true

require 'rails_helper'

# ============================================================================
# RESPONSE FORMAT CONTRACT SPECS
# ============================================================================
# Purpose: lock down the SHAPE of every API endpoint response — exact key-set,
# data types, and timestamp formats — so refactors that change the response
# (missing field, rename, new field) CANNOT pass without updating tests.
#
# Key-sets are defined ONCE in spec/support/response_contracts.rb
# (ResponseContracts module) and shared with serializer unit specs.
#
# Conventions:
#   - expect_keys      → exact key-set (fails on missing OR unexpected keys)
#   - expect_all_keys  → same, for each element of an array
#   - expect_timestamp → ISO8601 UTC string ("2026-08-21T15:23:16.100Z")
#   - expect_integers  → fields must be Integer type
#
# If intentionally changing the API contract: update ResponseContracts first,
# then this spec, ideally with a version path bump (/api/v1 → /api/v2).
# ============================================================================
RSpec.describe 'API Response Format Contracts', type: :request do
  let(:user) { create(:user, :admin) }
  let(:headers) { auth_headers(user) }

  before { with_tenant }

  # ────────────────────────────────────────────────────────────────────────
  # POST /api/v1/auth/login
  # ────────────────────────────────────────────────────────────────────────
  describe 'POST /api/v1/auth/login' do
    let(:admin_user) { create(:user, :admin, password: 'secret123', password_confirmation: 'secret123') }

    it 'returns token and user object with exact shape' do
      post '/api/v1/auth/login',
           params: { email: admin_user.email, password: 'secret123' },
           headers: { 'X-Tenant-Scheme' => 'test-corp' }

      expect_json_response
      expect_keys(json_body, :token, :user)

      expect_keys(json_body['user'], :id, :email, :role)
      expect_integers(json_body['user'], :id)
      expect(json_body['token']).to be_a(String).and be_present
    end

    it 'error responses follow the standard error envelope' do
      post '/api/v1/auth/login',
           params: { email: admin_user.email, password: 'wrong' },
           headers: { 'X-Tenant-Scheme' => 'test-corp' }

      expect_error(status: :unauthorized, message: 'Invalid email or password')
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # GET /api/v1/assessments
  # ────────────────────────────────────────────────────────────────────────
  describe 'GET /api/v1/assessments' do
    let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }
    let!(:session) { create(:session, :active, assessment: assessment) }

    it 'index returns exact collection + meta shape' do
      get '/api/v1/assessments', headers: headers

      expect_json_response
      expect_keys(json_body, :assessments, :meta)

      expect_all_keys(json_body['assessments'], *ResponseContracts::ASSESSMENT_KEYS)
      expect_keys(json_body['assessments'].first['latest_session'], *ResponseContracts::LATEST_SESSION_KEYS)

      expect_integers(json_body['assessments'].first, :id, :time_limit_min, :created_by)
      expect_timestamp(json_body['assessments'].first['created_at'])

      expect_keys(json_body['meta'], *ResponseContracts::PAGINATION_META_KEYS)
      expect_integers(json_body['meta'], *ResponseContracts::PAGINATION_META_KEYS)
    end

    it 'loads latest_session without N+1 queries' do
      create_list(:assessment, 5, tenant_id: 1)
      create(:session, :active, assessment: Assessment.first)

      queries = 0
      subscriber = ActiveSupport::Notifications.subscribe('sql.active_record') do |*, payload|
        queries += 1 if payload[:sql] =~ /\A\s*SELECT/i
      end

      begin
        get '/api/v1/assessments', headers: headers
      ensure
        ActiveSupport::Notifications.unsubscribe(subscriber)
      end

      expect_json_response
      # Tenant lookup + COUNT + main SELECT (+ small buffer) — must NOT grow
      # linearly with the number of assessments.
      expect(queries).to be <= 8
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # GET /api/v1/assessments/:id
  # ────────────────────────────────────────────────────────────────────────
  describe 'GET /api/v1/assessments/:id' do
    let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }

    it 'show returns assessment with skills array of exact shape' do
      get "/api/v1/assessments/#{assessment.id}", headers: headers

      expect_json_response
      expect_keys(json_body, :assessment)

      expect_keys(json_body['assessment'], *(ResponseContracts::ASSESSMENT_KEYS + [:skills]))
      expect_all_keys(json_body['assessment']['skills'], *ResponseContracts::ASSESSMENT_SKILL_KEYS)
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # POST /api/v1/assessments
  # ────────────────────────────────────────────────────────────────────────
  describe 'POST /api/v1/assessments' do
    it 'create returns serialized assessment + system_prompt_generated flag' do
      post '/api/v1/assessments',
           params: { assessment: { name: 'Contract Test', time_limit_min: 30 } },
           headers: headers

      expect_json_response(status: :created)
      expect_keys(json_body, :assessment, :system_prompt_generated)
      expect(json_body['system_prompt_generated']).to be true

      # Serialized via AssessmentSerializer — explicit fields only.
      # NOTE: system_prompt is intentionally NOT exposed (large text payload).
      expect_keys(json_body['assessment'], *ResponseContracts::ASSESSMENT_KEYS)
      expect_timestamp(json_body['assessment']['created_at'])
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # PUT /api/v1/assessments/:id
  # ────────────────────────────────────────────────────────────────────────
  describe 'PUT /api/v1/assessments/:id' do
    let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }

    it 'update returns assessment + skills + system_prompt_generated flag' do
      put "/api/v1/assessments/#{assessment.id}",
          params: { assessment: { name: 'Updated Contract' } },
          headers: headers

      expect_json_response
      expect_keys(json_body, :assessment, :system_prompt_generated)
      expect_keys(json_body['assessment'], *(ResponseContracts::ASSESSMENT_KEYS + [:skills]))
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # DELETE /api/v1/assessments/:id
  # ────────────────────────────────────────────────────────────────────────
  describe 'DELETE /api/v1/assessments/:id' do
    let!(:assessment) { create(:assessment, tenant_id: 1) }

    it 'destroy returns a message envelope' do
      delete "/api/v1/assessments/#{assessment.id}", headers: headers

      expect_json_response
      expect_keys(json_body, :message)
      expect(json_body['message']).to eq('Assessment deleted')
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # GET/POST /api/v1/assessments/:assessment_id/sessions
  # ────────────────────────────────────────────────────────────────────────
  describe '/api/v1/assessments/:assessment_id/sessions' do
    let!(:assessment) { create(:assessment, tenant_id: 1) }

    it 'index returns sessions array with exact session shape' do
      create(:session, :active, assessment: assessment)

      get "/api/v1/assessments/#{assessment.id}/sessions", headers: headers

      expect_json_response
      expect_keys(json_body, :sessions)
      expect_all_keys(json_body['sessions'], *ResponseContracts::SESSION_KEYS)
      expect_timestamp(json_body['sessions'].first['created_at'])
    end

    it 'create returns session + invite_url' do
      post "/api/v1/assessments/#{assessment.id}/sessions",
           params: { session: { candidate_id: 42, candidate_name: 'Candi' } },
           headers: headers

      expect_json_response(status: :created)
      expect_keys(json_body, :session, :invite_url)

      expect_keys(json_body['session'], *ResponseContracts::SESSION_KEYS)
      expect(json_body['invite_url']).to be_a(String).and be_present
      expect(json_body['session']['status']).to eq('pending')
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # GET /api/v1/vacancies (+ CRUD)
  # ────────────────────────────────────────────────────────────────────────
  describe '/api/v1/vacancies' do
    it 'index returns vacancies + meta with exact shape' do
      create(:vacancy, role_title: 'Role A', tenant_id: 1)

      get '/api/v1/vacancies', headers: headers

      expect_json_response
      expect_keys(json_body, :vacancies, :meta)

      expect_all_keys(json_body['vacancies'], *ResponseContracts::VACANCY_KEYS)
      expect_integers(json_body['vacancies'].first, :id, :created_by)

      expect_keys(json_body['meta'], *ResponseContracts::PAGINATION_META_KEYS)
    end

    it 'show returns vacancy with skills of exact shape' do
      vacancy = create(:vacancy, :with_skills, tenant_id: 1)

      get "/api/v1/vacancies/#{vacancy.id}", headers: headers

      expect_json_response
      expect_keys(json_body, :vacancy)

      expect_keys(json_body['vacancy'], *(ResponseContracts::VACANCY_KEYS + [:skills]))
      expect_all_keys(json_body['vacancy']['skills'], *ResponseContracts::VACANCY_SKILL_KEYS)
    end

    it 'create returns created vacancy with same shape as show' do
      post '/api/v1/vacancies',
           params: { vacancy: { role_title: 'New Role', vacancy_skills_attributes: [
             { skill_id: 'SK-C-001', skill_label: 'Skill C', expected_level: 2 }
           ] } },
           headers: headers

      expect_json_response(status: :created)
      expect_keys(json_body, :vacancy)
      expect_keys(json_body['vacancy'], *(ResponseContracts::VACANCY_KEYS + [:skills]))
      expect(json_body['vacancy']['skills'].size).to eq(1)
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # GET /api/v1/skill_taxonomies
  # ────────────────────────────────────────────────────────────────────────
  describe '/api/v1/skill_taxonomies' do
    let!(:taxonomy) { create(:skill_taxonomy) }

    it 'index returns exact skill shape' do
      get '/api/v1/skill_taxonomies', headers: headers

      expect_json_response
      expect_keys(json_body, :skill_taxonomies)
      expect_all_keys(json_body['skill_taxonomies'], *ResponseContracts::TAXONOMY_KEYS)
    end

    it 'show returns single skill with same shape' do
      get "/api/v1/skill_taxonomies/#{taxonomy.skill_id}", headers: headers

      expect_json_response
      expect_keys(json_body, :skill)
      expect_keys(json_body['skill'], *ResponseContracts::TAXONOMY_KEYS)
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # GET /api/v1/sessions/:id (detail), end_session, coverage, transcript
  # ────────────────────────────────────────────────────────────────────────
  describe '/api/v1/sessions/:id' do
    let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }
    let!(:session) { create(:session, :active, assessment: assessment) }

    it 'show returns session + nested assessment summary' do
      get "/api/v1/sessions/#{session.id}", headers: headers

      expect_json_response
      expect_keys(json_body, :session)

      expect_keys(json_body['session'], *ResponseContracts::SESSION_WITH_ASSESSMENT_KEYS)
      expect_keys(json_body['session']['assessment'], *ResponseContracts::SESSION_ASSESSMENT_SUMMARY_KEYS)
    end

    it 'end_session returns ended session in same shape' do
      post "/api/v1/sessions/#{session.id}/end_session",
           params: { session: { reason: 'manual_assessor' } },
           headers: headers

      expect_json_response
      expect_keys(json_body, :session)
      expect_keys(json_body['session'], *ResponseContracts::SESSION_KEYS)
      expect(json_body['session']['status']).to eq('ended')
    end

    it 'coverage returns skills/discovered/updated_at' do
      create(:coverage_map, session: session, skill_label: 'Skill X')

      get "/api/v1/sessions/#{session.id}/coverage", headers: headers

      expect_json_response
      expect_keys(json_body, :skills, :discovered, :updated_at)

      expect_all_keys(json_body['skills'], *ResponseContracts::COVERAGE_MAP_KEYS)
      expect_integers(json_body['skills'].first, :probe_count)
      expect_all_keys(json_body['discovered'], *ResponseContracts::COVERAGE_MAP_KEYS)
    end

    it 'transcript returns turns + total' do
      create(:transcript_turn, session: session, turn_number: 1, speaker: 'ai', text: 'Hello')

      get "/api/v1/sessions/#{session.id}/transcript", headers: headers

      expect_json_response
      expect_keys(json_body, :turns, :total)

      expect_all_keys(json_body['turns'], *ResponseContracts::TRANSCRIPT_TURN_KEYS)

      # audio_*_ms may be null (no audio yet) — only validate type when present
      turn = json_body['turns'].first
      integer_keys = %i[turn_number]
      integer_keys += %i[audio_start_ms audio_end_ms] if turn['audio_start_ms']
      expect_integers(turn, *integer_keys)

      expect(json_body['total']).to be_a(Integer)
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # Candidate flow (no JWT)
  # ────────────────────────────────────────────────────────────────────────
  describe 'candidate endpoints' do
    let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }
    let!(:session) { create(:session, :active, assessment: assessment) }

    it 'GET /sessions/:token/candidate returns flat info object' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect_json_response
      expect_keys(json_body, :session_id, :role_title, :time_limit_min, :session_status, :consent_given)
      expect_integers(json_body, :session_id, :time_limit_min)
      expect(json_body['consent_given']).to be(true).or be(false)
    end

    it 'POST /sessions/:token/audio_complete returns ended + message' do
      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      expect_json_response
      expect_keys(json_body, :ended, :message)
      expect(json_body['ended']).to be(true).or be(false)
      expect(json_body['message']).to be_a(String)
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # Portfolios
  # ────────────────────────────────────────────────────────────────────────
  describe '/api/v1 portfolios' do
    let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }
    let!(:session) { create(:session, :ended, assessment: assessment) }
    let!(:portfolio) { create(:portfolio, :complete, session: session, candidate_id: 42) }
    let!(:portfolio_skill) { create(:portfolio_skill, portfolio: portfolio, skill_label: 'Test Skill') }

    it 'GET /sessions/:id/portfolio returns portfolio of exact shape' do
      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect_json_response
      expect_keys(json_body, :portfolio)

      expect_keys(json_body['portfolio'], *ResponseContracts::PORTFOLIO_KEYS)
      expect_all_keys(json_body['portfolio']['skills'], *ResponseContracts::PORTFOLIO_SKILL_KEYS)
      expect_all_keys(json_body['portfolio']['overrides'], *ResponseContracts::OVERRIDE_KEYS)

      expect_timestamp(json_body['portfolio']['generated_at'])
    end

    it '202 generating response has minimal shape' do
      portfolio.update!(generation_status: 'generating')

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:accepted)
      expect_keys(json_body, :status)
      expect(json_body['status']).to eq('generating')
    end

    it 'failed response adds top-level error' do
      portfolio.update!(generation_status: 'failed', generation_error: 'API error')

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect_json_response
      expect_keys(json_body, :portfolio, :error)
      expect(json_body['error']).to eq('API error')
    end

    it 'POST .../regenerate returns message + portfolio' do
      portfolio.update!(generation_status: 'failed', generation_error: 'API error')

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect_json_response
      expect_keys(json_body, :message, :portfolio)
      expect(json_body['message']).to eq('Portfolio generation queued')
    end

    it 'POST /portfolios/:id/regenerate_fitgap returns generating envelope' do
      vacancy = create(:vacancy, tenant_id: 1)

      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy.id }, headers: headers

      expect_json_response(status: :accepted)
      expect_keys(json_body, :status, :message)
      expect(json_body['status']).to eq('generating')
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # Fit/gap report
  # ────────────────────────────────────────────────────────────────────────
  describe 'fitgap report shape' do
    let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }
    let!(:session) { create(:session, :ended, assessment: assessment) }
    let!(:portfolio) { create(:portfolio, :complete, session: session) }
    let!(:vacancy) { create(:vacancy, tenant_id: 1) }
    let!(:report) { create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy) }

    it 'GET /portfolios/:id/fitgap/:vacancy_id returns exact report shape' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect_json_response
      expect_keys(json_body, :report)
      expect_keys(json_body['report'], *ResponseContracts::FIT_GAP_REPORT_KEYS)
      expect_timestamp(json_body['report']['generated_at'])
    end

    it 'cached POST /portfolios/:id/fitgap returns same report shape' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { fitgap: { vacancy_id: vacancy.id } }, headers: headers

      expect_json_response
      expect_keys(json_body, :report)
      expect_keys(json_body['report'], *ResponseContracts::FIT_GAP_REPORT_KEYS)
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # Portfolio skills override
  # ────────────────────────────────────────────────────────────────────────
  describe 'POST /api/v1/portfolio_skills/:id/override' do
    let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }
    let!(:session) { create(:session, :ended, assessment: assessment) }
    let!(:portfolio) { create(:portfolio, :complete, session: session) }
    let!(:portfolio_skill) { create(:portfolio_skill, portfolio: portfolio) }

    it 'returns override with exact shape' do
      post "/api/v1/portfolio_skills/#{portfolio_skill.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Strong evidence' } },
           headers: headers

      expect_json_response(status: :created)
      expect_keys(json_body, :override)
      expect_keys(json_body['override'], *ResponseContracts::OVERRIDE_KEYS)
      expect_integers(json_body['override'], :ai_level, :override_level, :overridden_by)
    end
  end

  # ────────────────────────────────────────────────────────────────────────
  # Standard error envelope — applies globally to all 404 handlers
  # ────────────────────────────────────────────────────────────────────────
  describe 'error envelope consistency' do
    let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }

    it '404s from RecordNotFound handlers use errors[].status/message' do
      get '/api/v1/sessions/99999', headers: headers

      expect_error(status: :not_found, message: 'Session not found')
    end

    it '422 validation errors use errors[].status/message' do
      post '/api/v1/assessments',
           params: { assessment: { time_limit_min: 30 } }, # empty name
           headers: headers

      expect_error(status: :unprocessable_entity)
    end
  end
end
