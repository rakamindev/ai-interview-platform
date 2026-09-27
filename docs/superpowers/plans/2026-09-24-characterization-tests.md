# Full-Stack Characterization Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated, deterministic characterization test suite for both the backend Rails API (RSpec) and frontend React web app (Vitest/Testing Library), locking in baseline system behaviors and documenting known architectural gaps and quirks.

**Architecture:** 
- In `api/`, configure RSpec 6 with FactoryBot, DatabaseCleaner, and helper modules; build request and unit characterization specs covering authentication, tenant resolution, session state transitions, fit/gap math, and portfolio generation.
- In `web/`, install and configure Vitest with React Testing Library and JSDOM; build component and service characterization specs covering API client interceptors, comparison tables, skill selection, and interview entry error fallbacks.

**Tech Stack:** 
- Backend: Ruby 3.3, Rails 7.0, RSpec 6.0, FactoryBot Rails, DatabaseCleaner, PostgreSQL
- Frontend: TypeScript, React 18, Vitest, `@testing-library/react`, `@testing-library/jest-dom`, JSDOM

---

### Task 1: Backend RSpec Test Harness Setup

**Files:**
- Create: `api/spec/spec_helper.rb`
- Create: `api/spec/rails_helper.rb`
- Create: `api/spec/support/database_cleaner.rb`
- Create: `api/spec/support/factory_bot.rb`
- Create: `api/spec/support/request_spec_helper.rb`
- Test: `api/spec/harness_sanity_spec.rb`

- [ ] **Step 1: Write the failing sanity spec**

```ruby
# api/spec/harness_sanity_spec.rb
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'HarnessSanity', type: :request do
  it 'boots the Rails test environment and connects to the database' do
    expect(Rails.env).to eq('test')
    expect(ActiveRecord::Base.connection.active?).to be true
  end
end
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bundle exec rspec spec/harness_sanity_spec.rb`
Expected: FAIL with `cannot load such file -- spec_helper` or `rails_helper`

- [ ] **Step 3: Implement RSpec helper and support configurations**

Create `api/spec/spec_helper.rb`:
```ruby
# frozen_string_literal: true

RSpec.configure do |config|
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.shared_context_metadata_behavior = :apply_to_host_groups
  config.filter_run_when_matching :focus
  config.example_status_persistence_file_path = 'spec/examples.txt'
  config.disable_monkey_patching!
  config.default_formatter = 'doc' if config.files_to_run.one?
  config.order = :random
  Kernel.srand config.seed
end
```

Create `api/spec/rails_helper.rb`:
```ruby
# frozen_string_literal: true

require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
abort('The Rails environment is running in production mode!') if Rails.env.production?
require 'rspec/rails'

Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |f| require f }

RSpec.configure do |config|
  config.use_transactional_fixtures = false
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!
end
```

Create `api/spec/support/database_cleaner.rb`:
```ruby
# frozen_string_literal: true

RSpec.configure do |config|
  config.before(:suite) do
    DatabaseCleaner.clean_with(:truncation)
  end

  config.before(:each) do
    DatabaseCleaner.strategy = :transaction
  end

  config.before(:each, type: :request) do
    DatabaseCleaner.strategy = :truncation
  end

  config.before(:each) do
    DatabaseCleaner.start
  end

  config.append_after(:each) do
    DatabaseCleaner.clean
  end
end
```

Create `api/spec/support/factory_bot.rb`:
```ruby
# frozen_string_literal: true

RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods
end
```

Create `api/spec/support/request_spec_helper.rb`:
```ruby
# frozen_string_literal: true

module RequestSpecHelper
  def authenticated_headers(user, scheme: 'test-corp')
    token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: scheme })
    {
      'Authorization' => "Bearer #{token}",
      'X-Tenant-Scheme' => scheme,
      'Content-Type' => 'application/json',
      'Accept' => 'application/json'
    }
  end

  def json_body
    JSON.parse(response.body).deep_symbolize_keys
  end
end

RSpec.configure do |config|
  config.include RequestSpecHelper, type: :request
end
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bundle exec rspec spec/harness_sanity_spec.rb` in `api/`
Expected: PASS (1 example, 0 failures)

- [ ] **Step 5: Commit**

```bash
git add api/spec/
git commit -m "test(api): setup rspec rails test harness and database cleaner"
```

---

### Task 2: Backend Factories for Core Entities

**Files:**
- Create: `api/spec/factories/organizations.rb`
- Create: `api/spec/factories/users.rb`
- Create: `api/spec/factories/assessments.rb`
- Create: `api/spec/factories/sessions.rb`
- Create: `api/spec/factories/transcript_turns.rb`
- Create: `api/spec/factories/vacancies.rb`
- Create: `api/spec/factories/portfolios.rb`
- Test: `api/spec/factories_sanity_spec.rb`

- [ ] **Step 1: Write the failing factory sanity spec**

```ruby
# api/spec/factories_sanity_spec.rb
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'FactoryBot Sanity', type: :model do
  it 'builds and persists all primary factories cleanly' do
    org = create(:organization)
    admin = create(:user, :admin)
    assessment = create(:assessment, tenant_id: org.id, created_by: admin.id)
    session = create(:session, tenant_id: org.id, assessment: assessment)
    vacancy = create(:vacancy, tenant_id: org.id, created_by: admin.id)
    portfolio = create(:portfolio, session: session)
    turn = create(:transcript_turn, session: session)

    expect(org).to be_persisted
    expect(admin).to be_persisted
    expect(assessment).to be_persisted
    expect(session).to be_persisted
    expect(vacancy).to be_persisted
    expect(portfolio).to be_persisted
    expect(turn).to be_persisted
  end
end
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bundle exec rspec spec/factories_sanity_spec.rb` in `api/`
Expected: FAIL with `ArgumentError: Factory not registered: "organization"`

- [ ] **Step 3: Define factories for all core models**

Create `api/spec/factories/organizations.rb`:
```ruby
# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    name { 'Test Corp' }
    sequence(:scheme) { |n| "test-corp-#{n}" }
    sequence(:identifier) { |n| "test-corp-#{n}" }
    sequence(:host) { |n| "org#{n}.example.com" }
    alias_hosts { [] }
    config { {} }
  end
end
```

Create `api/spec/factories/users.rb`:
```ruby
# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    password { 'password123' }
    role { 'user' }

    trait :admin do
      role { 'admin' }
    end
  end
end
```

Create `api/spec/factories/assessments.rb`:
```ruby
# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    name { 'Senior React Developer' }
    time_limit_min { 45 }
    tenant_id { 1 }
    created_by { 1 }
    language { 'en' }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_id) { |n| "sk-#{n}" }
    skill_label { 'React Framework' }
    is_custom { false }
    l1_anchor { 'Basic concepts' }
    l2_anchor { 'Routine tasks' }
    l3_anchor { 'Independent delivery' }
    l4_anchor { 'Architectural decisions' }
    l5_anchor { 'Domain authority' }
    expected_level { 3 }
  end
end
```

Create `api/spec/factories/sessions.rb`:
```ruby
# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    status { 'pending' }
    candidate_name { 'Alice Candidate' }
  end
end
```

Create `api/spec/factories/transcript_turns.rb`:
```ruby
# frozen_string_literal: true

FactoryBot.define do
  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text { 'I used React hooks and context for state management.' }
    audio_start_ms { 1000 }
    audio_end_ms { 4000 }
  end
end
```

Create `api/spec/factories/vacancies.rb`:
```ruby
# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    role_title { 'Lead Frontend Engineer' }
    culture_dimensions { 'Fast-paced, ownership' }
    competency_expectations { 'Deep React and TypeScript' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_id) { |n| "sk-#{n}" }
    skill_label { 'React Framework' }
    expected_level { 3 }
  end
end
```

Create `api/spec/factories/portfolios.rb`:
```ruby
# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    session
    generation_status { 'complete' }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_id) { |n| "sk-#{n}" }
    skill_label { 'React Framework' }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['I used React hooks and context for state management.'] }
    competency_summary { 'Demonstrates strong understanding of component lifecycle.' }
  end
end
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bundle exec rspec spec/factories_sanity_spec.rb` in `api/`
Expected: PASS (1 example, 0 failures)

- [ ] **Step 5: Clean up sanity spec and commit**

```bash
rm api/spec/harness_sanity_spec.rb api/spec/factories_sanity_spec.rb
git add api/spec/factories/
git commit -m "test(api): add factory bot definitions for core platform entities"
```

---

### Task 3: Backend Authentication & Tenant Scoping Characterization Specs

**Files:**
- Create: `api/spec/requests/api/v1/authentication_spec.rb`
- Create: `api/spec/requests/api/v1/tenant_scoping_spec.rb`

- [ ] **Step 1: Write Authentication Request Characterization Spec**

Create `api/spec/requests/api/v1/authentication_spec.rb`:
```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Authentication API Characterization', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp') }
  let!(:admin) { create(:user, :admin, email: 'admin@test.com', password: 'secretpassword') }
  let!(:member) { create(:user, role: 'user', email: 'member@test.com', password: 'secretpassword') }

  describe 'POST /api/v1/auth/login' do
    it 'authenticates admin successfully and returns token and user payload' do
      post '/api/v1/auth/login',
           params: { email: 'admin@test.com', password: 'secretpassword' }.to_json,
           headers: { 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:ok)
      expect(json_body[:token]).to be_present
      expect(json_body[:user]).to include(
        id: admin.id,
        email: 'admin@test.com',
        role: 'admin'
      )
    end

    it 'rejects invalid credentials with 401' do
      post '/api/v1/auth/login',
           params: { email: 'admin@test.com', password: 'wrongpassword' }.to_json,
           headers: { 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:unauthorized)
      expect(json_body[:error]).to eq('Invalid email or password')
    end

    it 'characterizes GAP P0-2: rejects non-admin users with 401 even with valid password' do
      post '/api/v1/auth/login',
           params: { email: 'member@test.com', password: 'secretpassword' }.to_json,
           headers: { 'Content-Type' => 'application/json' }

      # Current code strictly requires user.role == 'admin'
      expect(response).to have_http_status(:unauthorized)
      expect(json_body[:error]).to eq('Invalid email or password')
    end

    it 'characterizes scheme resolution from X-Tenant-Scheme header' do
      post '/api/v1/auth/login',
           params: { email: 'admin@test.com', password: 'secretpassword' }.to_json,
           headers: {
             'Content-Type' => 'application/json',
             'X-Tenant-Scheme' => 'custom-tenant-scheme'
           }

      expect(response).to have_http_status(:ok)
      token = json_body[:token]
      decoded = JsonWebToken.decode(token)
      expect(decoded[:scheme]).to eq('custom-tenant-scheme')
    end
  end
end
```

- [ ] **Step 2: Write Tenant Scoping & Cross-Tenant Leak Characterization Spec**

Create `api/spec/requests/api/v1/tenant_scoping_spec.rb`:
```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Tenant Scoping & Unscoped Endpoints Characterization', type: :request do
  let!(:org_a) { create(:organization, scheme: 'org-a') }
  let!(:org_b) { create(:organization, scheme: 'org-b') }
  let!(:admin_a) { create(:user, :admin) }

  let!(:assessment_b) { create(:assessment, tenant_id: org_b.id, created_by: 999) }
  let!(:session_b) { create(:session, tenant_id: org_b.id, assessment: assessment_b) }
  let!(:portfolio_b) { create(:portfolio, session: session_b, generation_status: 'complete') }
  let!(:vacancy_a) { create(:vacancy, tenant_id: org_a.id, created_by: admin_a.id) }

  describe 'Cross-Tenant Scoping Leak on Portfolios (GAP P0-3)' do
    it 'characterizes that regenerate_fitgap does not enforce tenant scoping and finds cross-tenant portfolio' do
      headers = authenticated_headers(admin_a, scheme: org_a.scheme)

      post "/api/v1/portfolios/#{portfolio_b.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy_a.id }.to_json,
           headers: headers

      # Current code calls Portfolio.find(params[:id]) without tenant scoping,
      # so it accepts the foreign portfolio from org_b.
      expect(response).to have_http_status(:accepted)
      expect(json_body[:status]).to eq('generating')
    end
  end
end
```

- [ ] **Step 3: Run specs to verify they pass**

Run: `bundle exec rspec spec/requests/api/v1/authentication_spec.rb spec/requests/api/v1/tenant_scoping_spec.rb` in `api/`
Expected: PASS (5 examples, 0 failures)

- [ ] **Step 4: Commit**

```bash
git add api/spec/requests/api/v1/authentication_spec.rb api/spec/requests/api/v1/tenant_scoping_spec.rb
git commit -m "test(api): characterize authentication roles and tenant scoping leaks"
```

---

### Task 4: Backend Session Lifecycle & Candidate Access Characterization Specs

**Files:**
- Create: `api/spec/models/session_spec.rb`
- Create: `api/spec/requests/api/v1/sessions_spec.rb`

- [ ] **Step 1: Write Session Model Characterization Spec**

Create `api/spec/models/session_spec.rb`:
```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:org) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: org.id) }

  it 'generates a 64-character hex invite token automatically on creation' do
    session = create(:session, assessment: assessment, tenant_id: org.id)
    expect(session.invite_token).to be_present
    expect(session.invite_token.length).to eq(64)
  end

  it 'defaults status to pending' do
    session = create(:session, assessment: assessment, tenant_id: org.id)
    expect(session.status).to eq('pending')
    expect(session.pending?).to be true
  end

  it 'characterizes GAP P0-1: invite_url points to port 3001 (API host) instead of web frontend' do
    session = create(:session, assessment: assessment, tenant_id: org.id)
    # APP_BASE_URL default is http://localhost:3001
    expect(session.invite_url).to eq("http://localhost:3001/interview/#{session.invite_token}")
  end
end
```

- [ ] **Step 2: Write Sessions Controller Request Spec**

Create `api/spec/requests/api/v1/sessions_spec.rb`:
```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Sessions API Characterization', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp') }
  let!(:admin) { create(:user, :admin) }
  let!(:assessment) { create(:assessment, tenant_id: org.id, created_by: admin.id) }
  let!(:session_record) { create(:session, assessment: assessment, tenant_id: org.id, status: 'active') }

  let(:headers) { authenticated_headers(admin, scheme: org.scheme) }

  describe 'POST /api/v1/sessions/:id/end' do
    it 'ends an active session with valid reason' do
      post "/api/v1/sessions/#{session_record.id}/end",
           params: { session: { reason: 'manual_assessor' } }.to_json,
           headers: headers

      expect(response).to have_http_status(:ok)
      expect(session_record.reload.status).to eq('ended')
      expect(session_record.end_reason).to eq('manual_assessor')
    end

    it 'returns 422 if session is already ended' do
      session_record.update!(status: 'ended')

      post "/api/v1/sessions/#{session_record.id}/end",
           params: { session: { reason: 'manual_assessor' } }.to_json,
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body[:error]).to eq('Session is already ended')
    end
  end

  describe 'Candidate Endpoints (Unauthenticated)' do
    it 'GET /sessions/:token/candidate returns candidate info without JWT' do
      get "/sessions/#{session_record.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      expect(json_body[:session_id]).to eq(session_record.id)
      expect(json_body[:candidate_name]).to eq(session_record.candidate_name)
      expect(json_body[:assessment_name]).to eq(assessment.name)
    end

    it 'returns 404 for invalid invite token' do
      get '/sessions/non-existent-token/candidate'
      expect(response).to have_http_status(:not_found)
      expect(json_body[:error]).to eq('Invalid or expired invite token')
    end

    it 'characterizes GAP P1-5: POST /sessions/:token/audio_complete force-ends session without checking coverage' do
      post "/sessions/#{session_record.invite_token}/audio_complete"

      expect(response).to have_http_status(:ok)
      expect(json_body[:ended]).to be true
      expect(session_record.reload.status).to eq('ended')
      expect(session_record.end_reason).to eq('all_covered')
    end
  end
end
```

- [ ] **Step 3: Run specs to verify they pass**

Run: `bundle exec rspec spec/models/session_spec.rb spec/requests/api/v1/sessions_spec.rb` in `api/`
Expected: PASS (6 examples, 0 failures)

- [ ] **Step 4: Commit**

```bash
git add api/spec/models/session_spec.rb api/spec/requests/api/v1/sessions_spec.rb
git commit -m "test(api): characterize session lifecycle, invite urls, and candidate endpoints"
```

---

### Task 5: Backend Fit/Gap Engine & Portfolio Generator Characterization Specs

**Files:**
- Create: `api/spec/services/fit_gap/engine_spec.rb`
- Create: `api/spec/services/portfolios/generator_spec.rb`

- [ ] **Step 1: Write Fit/Gap Engine Service Characterization Spec**

Create `api/spec/services/fit_gap/engine_spec.rb`:
```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:org) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session_record) { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:portfolio) { create(:portfolio, session: session_record) }
  let(:vacancy) { create(:vacancy, tenant_id: org.id) }

  let!(:vacancy_skill1) do
    create(:vacancy_skill, vacancy: vacancy, skill_id: 'sk-1', skill_label: 'Ruby on Rails', expected_level: 3)
  end
  let!(:vacancy_skill2) do
    create(:vacancy_skill, vacancy: vacancy, skill_id: 'sk-2', skill_label: 'PostgreSQL', expected_level: 4)
  end

  let!(:portfolio_skill1) do
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'sk-1', skill_label: 'Ruby on Rails', ai_level: 3)
  end
  let!(:portfolio_skill2) do
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'sk-2', skill_label: 'PostgreSQL', ai_level: 2)
  end

  let(:mock_gemini) { instance_double(Gemini::HttpClient) }

  before do
    allow(mock_gemini).to receive(:generate_content).and_return({
      'culture_narrative' => 'Strong collaborative mindset.',
      'overall_narrative' => 'Recommended for mid-level position.'
    })
  end

  it 'calculates skill level comparisons and classifies results' do
    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
    report = engine.call

    comparisons = report.skill_comparisons.map(&:deep_symbolize_keys)

    rails_comp = comparisons.find { |c| c[:skill_id] == 'sk-1' }
    expect(rails_comp[:result]).to eq('match')
    expect(rails_comp[:delta]).to eq(0)

    pg_comp = comparisons.find { |c| c[:skill_id] == 'sk-2' }
    expect(pg_comp[:result]).to eq('gap')
    expect(pg_comp[:delta]).to eq(-2)
  end

  it 'characterizes GAP P1-1: comparison payload emits expected_level (not required_level)' do
    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
    report = engine.call

    first_comp = report.skill_comparisons.first.deep_symbolize_keys
    expect(first_comp).to have_key(:expected_level)
    expect(first_comp).not_to have_key(:required_level)
  end

  it 'falls back to deterministic narrative when Gemini client raises an error' do
    allow(mock_gemini).to receive(:generate_content).and_raise(Faraday::TimeoutError.new('timeout'))

    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
    report = engine.call

    expect(report.culture_narrative).to be_nil
    expect(report.overall_narrative).to eq('Candidate shows 1 skill matches, 0 exceeds, and 1 gaps against role requirements.')
  end
end
```

- [ ] **Step 2: Write Portfolio Generator Service Characterization Spec**

Create `api/spec/services/portfolios/generator_spec.rb`:
```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:org) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session_record) { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:mock_gemini) { instance_double(Gemini::HttpClient) }

  let(:mock_response) do
    {
      'configured_skills' => [
        {
          'skill_id' => 'sk-1',
          'skill_label' => 'Ruby on Rails',
          'level' => 3,
          'confidence' => 'high',
          'evidence' => ['Built REST APIs with ActiveRecord'],
          'competency_summary' => 'Solid mid-level understanding.'
        }
      ],
      'discovered_skills' => []
    }.to_json
  end

  before do
    allow(mock_gemini).to receive(:generate_content).and_return(mock_response)
  end

  it 'generates a portfolio with skills parsed from Gemini response' do
    generator = described_class.new(session: session_record, gemini_client: mock_gemini)
    portfolio = generator.call

    expect(portfolio.generation_status).to eq('complete')
    expect(portfolio.portfolio_skills.count).to eq(1)

    skill = portfolio.portfolio_skills.first
    expect(skill.skill_id).to eq('sk-1')
    expect(skill.ai_level).to eq(3)
    expect(skill.ai_confidence).to eq('high')
  end

  it 'characterizes GAP P1-4: generator executes cleanly even when session transcript is completely empty' do
    expect(session_record.transcript_turns.count).to eq(0)

    generator = described_class.new(session: session_record, gemini_client: mock_gemini)
    portfolio = generator.call

    expect(portfolio.generation_status).to eq('complete')
  end
end
```

- [ ] **Step 3: Run specs to verify they pass**

Run: `bundle exec rspec spec/services/fit_gap/engine_spec.rb spec/services/portfolios/generator_spec.rb` in `api/`
Expected: PASS (5 examples, 0 failures)

- [ ] **Step 4: Commit**

```bash
git add api/spec/services/fit_gap/engine_spec.rb api/spec/services/portfolios/generator_spec.rb
git commit -m "test(api): characterize fit gap calculations and portfolio generator behavior"
```

---

### Task 6: Backend Assessment Management Characterization Specs

**Files:**
- Create: `api/spec/requests/api/v1/assessments_spec.rb`

- [ ] **Step 1: Write Assessments Request Spec**

Create `api/spec/requests/api/v1/assessments_spec.rb`:
```ruby
# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessments API Characterization', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp') }
  let!(:admin) { create(:user, :admin) }
  let(:headers) { authenticated_headers(admin, scheme: org.scheme) }

  before do
    # Prevent actual background worker from executing
    allow(SystemPromptGeneratorWorker).to receive(:perform_async)
  end

  describe 'POST /api/v1/assessments' do
    let(:valid_params) do
      {
        assessment: {
          name: 'Staff Backend Architect',
          time_limit_min: 45,
          language: 'en'
        }
      }
    end

    it 'creates an assessment and enqueues prompt generator worker' do
      post '/api/v1/assessments',
           params: valid_params.to_json,
           headers: headers

      expect(response).to have_http_status(:created)
      expect(SystemPromptGeneratorWorker).to have_received(:perform_async)
    end

    it 'characterizes GAP P2-5: returns system_prompt_generated: true synchronously before worker runs' do
      post '/api/v1/assessments',
           params: valid_params.to_json,
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_body[:system_prompt_generated]).to be true
    end

    it 'characterizes GAP P3-3: create returns raw model JSON without skills, unlike index/show' do
      post '/api/v1/assessments',
           params: valid_params.to_json,
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_body[:assessment]).to have_key(:id)
      expect(json_body[:assessment]).to have_key(:name)
      expect(json_body[:assessment]).not_to have_key(:skills)
    end
  end
end
```

- [ ] **Step 2: Run spec to verify it passes**

Run: `bundle exec rspec spec/requests/api/v1/assessments_spec.rb` in `api/`
Expected: PASS (3 examples, 0 failures)

- [ ] **Step 3: Commit**

```bash
git add api/spec/requests/api/v1/assessments_spec.rb
git commit -m "test(api): characterize assessment creation and worker dispatch flags"
```

---

### Task 7: Frontend Vitest & Testing Library Harness Setup

**Files:**
- Modify: `web/package.json`
- Modify: `web/vite.config.ts`
- Create: `web/src/test/setup.ts`
- Test: `web/src/test/sanity.test.ts`

- [ ] **Step 1: Install Vitest and test dependencies in `web/`**

Run in `web/`:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Add test scripts to `web/package.json`**

In `web/package.json`, add `"test": "vitest run"` under `"scripts"`:
```json
    "scripts": {
        "dev": "vite",
        "build": "tsc && vite build",
        "preview": "vite preview",
        "test": "vitest run"
    },
```

- [ ] **Step 3: Update `web/vite.config.ts` with test configuration**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    // @ts-expect-error vitest config
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: "./src/test/setup.ts",
    },
});
```

- [ ] **Step 4: Create `web/src/test/setup.ts`**

```typescript
import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
    cleanup();
});

// Polyfill window.matchMedia
Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }),
});

// Polyfill ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};
```

- [ ] **Step 5: Create frontend sanity test and verify**

Create `web/src/test/sanity.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("Frontend Test Harness Sanity", () => {
    it("runs in jsdom environment with document available", () => {
        expect(typeof document).toBe("object");
        expect(document.createElement("div")).toBeDefined();
    });
});
```

Run in `web/`: `npm test`
Expected: PASS (1 test passed)

- [ ] **Step 6: Remove sanity test and commit**

```bash
rm web/src/test/sanity.test.ts
git add web/package.json web/vite.config.ts web/src/test/setup.ts
git commit -m "test(web): setup vitest and react testing library harness"
```

---

### Task 8: Frontend API Client & Interceptor Characterization Tests

**Files:**
- Create: `web/src/test/services/api.test.ts`

- [ ] **Step 1: Write API Interceptors Characterization Spec**

Create `web/src/test/services/api.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import api from "@/services/api";
import { setStoredToken, clearToken } from "@/stores/authAtom";

describe("API Service Interceptors Characterization", () => {
    beforeEach(() => {
        clearToken();
        vi.restoreAllMocks();
    });

    it("attaches Authorization header when token is stored", async () => {
        setStoredToken("test-jwt-token");

        // Spy on axios request adapter / interceptor
        const config = await api.interceptors.request.handlers[0].fulfilled({
            headers: {} as any,
        } as any);

        expect(config.headers.Authorization).toBe("Bearer test-jwt-token");
    });

    it("characterizes GAP P3-2: unwraps response when enveloped in { data: ... }", () => {
        const responseHandler = api.interceptors.response.handlers[0].fulfilled;

        const envelopedResponse = {
            data: {
                data: {
                    user: { id: 1, name: "Admin" },
                },
            },
        } as any;

        const result = responseHandler(envelopedResponse);
        expect(result.data).toEqual({ user: { id: 1, name: "Admin" } });
    });

    it("characterizes GAP P3-2: leaves payload unchanged when backend returns bare keys", () => {
        const responseHandler = api.interceptors.response.handlers[0].fulfilled;

        const bareResponse = {
            data: {
                token: "jwt-xyz",
                user: { id: 1, email: "admin@test.com" },
            },
        } as any;

        const result = responseHandler(bareResponse);
        expect(result.data).toEqual({
            token: "jwt-xyz",
            user: { id: 1, email: "admin@test.com" },
        });
    });

    it("clears token and redirects on 401 response", () => {
        setStoredToken("expired-token");

        delete (window as any).location;
        window.location = { href: "" } as any;

        const errorHandler = api.interceptors.response.handlers[0].rejected;

        const error = {
            response: { status: 401 },
        };

        expect(() => errorHandler(error)).toThrow();
        expect(window.location.href).toBe("/login");
    });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run in `web/`: `npm test src/test/services/api.test.ts`
Expected: PASS (4 tests passed)

- [ ] **Step 3: Commit**

```bash
git add web/src/test/services/api.test.ts
git commit -m "test(web): characterize api client request headers and envelope unwrapping"
```

---

### Task 9: Frontend ComparisonTable Component Characterization Tests

**Files:**
- Create: `web/src/test/components/fitgap/ComparisonTable.test.tsx`

- [ ] **Step 1: Write ComparisonTable Component Characterization Spec**

Create `web/src/test/components/fitgap/ComparisonTable.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable Component Characterization", () => {
    it("renders rows with skill label and correct result badges", () => {
        const comparisons: SkillComparison[] = [
            {
                skill_label: "TypeScript",
                required_level: 3,
                candidate_level: 3,
                result: "match",
                delta: 0,
            },
            {
                skill_label: "PostgreSQL",
                required_level: 4,
                candidate_level: 2,
                result: "gap",
                delta: -2,
            },
        ];

        render(<ComparisonTable comparisons={comparisons} />);

        expect(screen.getByText("TypeScript")).toBeInTheDocument();
        expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
        expect(screen.getByText(/Match/i)).toBeInTheDocument();
        expect(screen.getByText(/Gap -2/i)).toBeInTheDocument();
    });

    it("displays pencil indicator for overridden skills", () => {
        const comparisons: SkillComparison[] = [
            {
                skill_label: "React",
                required_level: 3,
                candidate_level: 4,
                result: "exceed",
                delta: 1,
                is_override: true,
            },
        ];

        render(<ComparisonTable comparisons={comparisons} />);
        expect(screen.getByText("✏")).toBeInTheDocument();
    });

    it("characterizes GAP P1-1: renders blank Required column when API provides expected_level instead of required_level", () => {
        // Current API engine emits expected_level, not required_level
        const apiFormattedComparisons = [
            {
                skill_label: "Docker",
                expected_level: 3,
                candidate_level: 3,
                result: "match",
                delta: 0,
            } as unknown as SkillComparison,
        ];

        const { container } = render(<ComparisonTable comparisons={apiFormattedComparisons} />);

        // The Required column cell (index 1 in table row) is empty because c.required_level is undefined
        const row = container.querySelector("tbody tr");
        const requiredCell = row?.querySelectorAll("td")[1];
        expect(requiredCell?.textContent?.trim()).toBe("");
    });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run in `web/`: `npm test src/test/components/fitgap/ComparisonTable.test.tsx`
Expected: PASS (3 tests passed)

- [ ] **Step 3: Commit**

```bash
git add web/src/test/components/fitgap/ComparisonTable.test.tsx
git commit -m "test(web): characterize comparison table badges and required level mismatch"
```

---

### Task 10: Frontend SkillPicker & InterviewPage Characterization Tests

**Files:**
- Create: `web/src/test/components/assessment/SkillPicker.test.tsx`
- Create: `web/src/test/pages/interview/InterviewPage.test.tsx`

- [ ] **Step 1: Write SkillPicker Component Characterization Spec**

Create `web/src/test/components/assessment/SkillPicker.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SkillPicker from "@/components/assessment/SkillPicker";
import api from "@/services/api";

describe("SkillPicker Component Characterization", () => {
    it("characterizes GAP P1-2: onSelect drops skill_id and passes undefined", async () => {
        const onSelect = vi.fn();
        const onOpenChange = vi.fn();

        vi.spyOn(api, "get").mockResolvedValue({
            data: {
                skill_taxonomies: [
                    {
                        id: 42,
                        skill_id: "sk-tax-042",
                        skill_label: "Ruby Architecture",
                        category: "Backend",
                        scope_include: "Rails, SQL",
                        l1_anchor: "Junior",
                        l2_anchor: "Mid",
                        l3_anchor: "Senior",
                        l4_anchor: "Lead",
                        l5_anchor: "Principal",
                    },
                ],
            },
        } as any);

        render(<SkillPicker open={true} onOpenChange={onOpenChange} onSelect={onSelect} />);

        await waitFor(() => {
            expect(screen.getByText("Ruby Architecture")).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText("Ruby Architecture"));

        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({
                skill_label: "Ruby Architecture",
                skill_id: undefined, // GAP P1-2: Dropped skill_id
                expected_level: 3,
            })
        );
    });
});
```

- [ ] **Step 2: Write InterviewPage Characterization Spec**

Create `web/src/test/pages/interview/InterviewPage.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/api";

describe("InterviewPage Characterization", () => {
    it("characterizes GAP P3-5: invalid invite token displays Interview Complete screen instead of error", async () => {
        // When token is invalid, getCandidateInfo rejects with 404
        vi.spyOn(sessionsApi, "getCandidateInfo").mockRejectedValue(new Error("Invalid token"));

        render(
            <MemoryRouter initialEntries={["/interview/invalid-token-123"]}>
                <Routes>
                    <Route path="/interview/:token" element={<InterviewPage />} />
                </Routes>
            </MemoryRouter>
        );

        // Catch block sets interviewState to 'complete'
        await waitFor(() => {
            expect(screen.getByText(/Interview Complete/i)).toBeInTheDocument();
        });
    });

    it("displays hardware check when token is valid and session is pending", async () => {
        vi.spyOn(sessionsApi, "getCandidateInfo").mockResolvedValue({
            data: {
                session_id: 101,
                session_status: "pending",
                candidate_name: "Bob Candidate",
                assessment_name: "Frontend Engineer",
                time_limit_min: 45,
            },
        } as any);

        render(
            <MemoryRouter initialEntries={["/interview/valid-token-101"]}>
                <Routes>
                    <Route path="/interview/:token" element={<InterviewPage />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Frontend Engineer/i)).toBeInTheDocument();
        });
    });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run in `web/`: `npm test src/test/components/assessment/SkillPicker.test.tsx src/test/pages/interview/InterviewPage.test.tsx`
Expected: PASS (3 tests passed)

- [ ] **Step 4: Commit**

```bash
git add web/src/test/components/assessment/SkillPicker.test.tsx web/src/test/pages/interview/InterviewPage.test.tsx
git commit -m "test(web): characterize skill picker taxonomy selection and interview token error fallback"
```

---

### Task 11: Full-Suite Verification & Documentation

**Files:**
- Modify: `README.md` (Add Testing Instructions section)

- [ ] **Step 1: Run full backend test suite**

Run in `api/`:
```bash
bundle exec rspec
```
Expected: All backend specs PASS (20+ examples, 0 failures).

- [ ] **Step 2: Run full frontend test suite**

Run in `web/`:
```bash
npm test
```
Expected: All frontend specs PASS (10+ tests, 0 failures).

- [ ] **Step 3: Add Testing Instructions to Root `README.md`**

In `README.md`, add a section:
```markdown
## Running Characterization Tests

The repository includes full-stack characterization test suites capturing existing baseline behaviors and documented quirks:

1. **Backend (`api/`)**:
   ```bash
   cd api
   RAILS_ENV=test bundle exec rails db:test:prepare
   bundle exec rspec
   ```

2. **Frontend (`web/`)**:
   ```bash
   cd web
   npm test
   ```
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document test execution for backend and frontend characterization suites"
```
