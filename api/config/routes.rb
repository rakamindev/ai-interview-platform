# frozen_string_literal: true

Rails.application.routes.draw do
  root to: proc { [200, { 'Content-Type' => 'application/json' }, [{ status: 'ok', service: 'AI Interview Platform API', version: 'v1', health: '/health' }.to_json]] }
  get '/health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

  # Redirect browser visits to /interview/:token from Rails API (port 3001) to Web Frontend (port 5173)
  get '/interview/:token', to: redirect { |params, _req|
    frontend = ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
    "#{frontend}/interview/#{params[:token]}"
  }

  namespace :api do
    namespace :v1 do
      # Auth
      post 'auth/login',  to: 'authentication#authenticate'
      post 'auth/google', to: 'authentication#authenticate_google'
      get  'auth/me',     to: 'authentication#me'
      # Health check
      get  'health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

      # Upload speed test — accepts any payload, discards it, returns bytes received
      post 'speed_test', to: proc { |env|
        bytes = env['CONTENT_LENGTH'].to_i
        [200, { 'Content-Type' => 'application/json' }, [{ received_bytes: bytes }.to_json]]
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
