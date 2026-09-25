# frozen_string_literal: true

Rails.application.routes.draw do
  get '/health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

  namespace :api do
    namespace :v1 do
      # Auth
      post 'auth/login', to: 'authentication#authenticate'
      # Health check
      get  'health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

      # Speed tests target the application itself, avoiding third-party CORS and
      # measuring the same network path used by the interview.
      get 'speed_test', to: proc { |env|
        bytes = [[Rack::Request.new(env).params.fetch('bytes', 262_144).to_i, 1].max, 524_288].min
        [200, {
          'Content-Type' => 'application/octet-stream',
          'Content-Length' => bytes.to_s,
          'Cache-Control' => 'no-store'
        }, ['0' * bytes]]
      }

      # Upload speed test — accepts any payload, discards it, returns bytes received
      post 'speed_test', to: proc { |env|
        request = Rack::Request.new(env)
        bytes = request.body.read(524_289).bytesize
        status = bytes > 524_288 ? 413 : 200
        [status, { 'Content-Type' => 'application/json', 'Cache-Control' => 'no-store' },
         [{ received_bytes: [bytes, 524_288].min }.to_json]]
      }

      # Assessments
      resources :assessments do
        resources :sessions, only: %i[index create]
      end

      # Sessions
      resources :sessions, only: %i[show] do
        member do
          post :end_session
          get  :coverage
          get  :transcript
          get  :portfolio, to: 'portfolios#show'
          post 'portfolio/regenerate', to: 'portfolios#regenerate'
        end
      end

      # Candidate-facing (no JWT — invite token only)
      get  'sessions/:token/candidate',      to: 'sessions#candidate_info'
      post 'sessions/:token/audio_complete', to: 'sessions#audio_complete'

      # Portfolio skills overrides
      resources :portfolio_skills, only: [] do
        member do
          post :override
        end
      end

      # B7 Skill Taxonomy (read-only reference data)
      get  'skill_taxonomies',          to: 'skill_taxonomies#index'
      get  'skill_taxonomies/:skill_id', to: 'skill_taxonomies#show', as: :skill_taxonomy

      # Vacancies
      resources :vacancies

      # Portfolios — fit/gap and export
      resources :portfolios, only: [] do
        member do
          post :fitgap
          post :regenerate_fitgap
          get  'fitgap/:vacancy_id', to: 'portfolios#show_fitgap', as: :fitgap_vacancy
          get  :export
        end
      end
    end
  end
end
