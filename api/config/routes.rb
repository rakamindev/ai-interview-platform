# frozen_string_literal: true

require 'securerandom'

Rails.application.routes.draw do
  get '/health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

  namespace :api do
    namespace :v1 do
      # Auth
      post 'auth/login', to: 'authentication#authenticate'
      # Health check
      get  'health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

      # Speed test — candidate hardware check probes the platform's own API so
      # healthy connections aren't rejected because third-party test services
      # (CDNs / httpbin / postman-echo) are slow, blocked, or CORS-restricted.
      # GET  streams a fixed-size random payload for download measurement.
      # POST accepts any payload, discards it, returns bytes received.
      get 'speed_test', to: proc {
        bytes = 3 * 1024 * 1024
        headers = {
          'Content-Type' => 'application/octet-stream',
          'Cache-Control' => 'no-store',
          'Content-Length' => bytes.to_s
        }
        [200, headers, [::SecureRandom.random_bytes(bytes)]]
      }
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
      # NB: candidate transcript lives under /candidate to avoid shadowing the
      # assessor's authenticated GET sessions/:id/transcript member route.
      get    'sessions/:token/candidate',            to: 'sessions#candidate_info'
      get    'sessions/:token/candidate/transcript', to: 'sessions#candidate_transcript'
      post   'sessions/:token/consent',              to: 'sessions#consent'
      post   'sessions/:token/consent/revoke',       to: 'sessions#consent_revoke'
      delete 'sessions/:token/data',                 to: 'sessions#candidate_data_delete'
      post   'sessions/:token/audio_complete',       to: 'sessions#audio_complete'

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
