# frozen_string_literal: true

Rails.application.routes.draw do
  get '/health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

  # Stale candidate invite links that point at this API host: bounce them to
  # the web app, where /interview/:token is served by the SPA.
  # 302 (not 301) so browsers/proxies never cache a token-scoped URL.
  get '/interview/:token', to: redirect(status: 302) { |params, _request|
    "#{ENV.fetch('WEB_BASE_URL', 'http://localhost:5173')}/interview/#{params[:token]}"
  }

  namespace :api do
    namespace :v1 do
      # Auth
      post 'auth/login',           to: 'authentication#authenticate'
      post 'auth/change_password', to: 'authentication#change_password'

      # Admin-only user management (no public signup)
      resources :users, only: %i[index create]
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

      # Tenant-scoped reusable custom skills
      resources :custom_skills, only: %i[index create destroy]

      # Vacancies
      resources :vacancies do
        member do
          get :matches
        end
      end

      # Candidate-centric view
      resources :candidates, only: %i[index]

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
