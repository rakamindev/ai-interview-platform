# frozen_string_literal: true

Rails.application.routes.draw do
  get '/health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

  namespace :api do
    namespace :v1 do
      # Auth
      post 'auth/login', to: 'authentication#authenticate'
      # Health check
      get  'health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

      # Speed test, both directions, served from our own origin.
      #
      # The candidate runs this seconds before an interview, so measuring their
      # line against a public CDN would hand their IP and timing to third
      # parties we never named in the consent notice — and would measure the
      # route to that CDN rather than the route to the service they are about
      # to talk to. Both problems disappear when the bytes come from here.

      # Download: a fixed, incompressible payload. `?bytes=` is clamped so the
      # endpoint cannot be turned into an outbound bandwidth amplifier.
      get 'speed_test', to: proc { |env|
        requested = Rack::Request.new(env).params['bytes'].to_i
        bytes = requested.clamp(64 * 1024, 2 * 1024 * 1024)
        bytes = 512 * 1024 if requested.zero?

        [200, {
          'Content-Type' => 'application/octet-stream',
          'Cache-Control' => 'no-store, no-cache, must-revalidate',
          'Content-Length' => bytes.to_s
        }, [SecureRandom.bytes(bytes)]]
      }

      # Upload: accepts any payload, discards it, returns bytes received
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
      get  'sessions/:token/consent',        to: 'sessions#consent_policy'
      post 'sessions/:token/consent',        to: 'sessions#consent'

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
