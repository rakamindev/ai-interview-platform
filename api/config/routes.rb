# frozen_string_literal: true

Rails.application.routes.draw do
  get '/health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

  # Web redirect fallback for candidate links opened on the API port
  get '/interview/:token', to: redirect { |params, _req|
    frontend = ENV.fetch('FRONTEND_URL', ENV.fetch('WEB_BASE_URL', 'http://localhost:5173'))
    "#{frontend}/interview/#{params[:token]}"
  }

  get '/feedback/:token', to: redirect { |params, _req|
    frontend = ENV.fetch('FRONTEND_URL', ENV.fetch('WEB_BASE_URL', 'http://localhost:5173'))
    "#{frontend}/feedback/#{params[:token]}"
  }

  namespace :api do
    namespace :v1 do
      # Auth
      post 'auth/login', to: 'authentication#authenticate'
      # Health check
      get  'health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

      # Upload speed test — accepts any payload, discards it, returns bytes received
      post 'speed_test', to: proc { |env|
        bytes = env['CONTENT_LENGTH'].to_i
        [200, { 'Content-Type' => 'application/json' }, [{ received_bytes: bytes }.to_json]]
      }

      # Assessments
      resources :assessments do
        member do
          get :comparison
        end
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
      get  'sessions/:token/feedback',       to: 'sessions#feedback'
      post 'sessions/:token/audio_complete', to: 'sessions#audio_complete'
      post 'sessions/:token/integrity',      to: 'sessions#integrity'

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
