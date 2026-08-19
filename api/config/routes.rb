# frozen_string_literal: true

Rails.application.routes.draw do
  get '/health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

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

      # Download speed test — returns `size` random bytes (default 200KB, capped at 2MB)
      # so the client can time a real download against this same server.
      get 'speed_test', to: proc { |env|
        requested = Rack::Request.new(env).params['size'].to_i
        size = requested.positive? ? requested.clamp(1, 2_000_000) : 200_000
        [200, { 'Content-Type' => 'application/octet-stream' }, [SecureRandom.random_bytes(size)]]
      }

      # Assessments
      resources :assessments do
        member { post :archive; post :unarchive }
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
      post 'sessions/:token/biodata',        to: 'sessions#candidate_biodata'
      post 'sessions/:token/audio_complete', to: 'sessions#audio_complete'

      # Portfolio skills overrides
      resources :portfolio_skills, only: [] do
        member do
          post :override
        end
      end

      # B7 Skill Taxonomy (read-only reference data)
      get  'skill_taxonomies',          to: 'skill_taxonomies#index'
      post 'skill_taxonomies/suggest',   to: 'skill_taxonomies#suggest'
      get  'skill_taxonomies/:skill_id', to: 'skill_taxonomies#show', as: :skill_taxonomy

      # Candidates
      resources :candidates, only: %i[index show]

      # Admin invites
      resources :admin_invites, only: %i[index create]
      get  'admin_invites/:token',         to: 'admin_invites#show'
      post 'admin_invites/:token/accept',  to: 'admin_invites#accept'

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
