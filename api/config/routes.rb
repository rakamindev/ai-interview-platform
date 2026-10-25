# frozen_string_literal: true

Rails.application.routes.draw do
  get '/health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

  namespace :api do
    namespace :v1 do
      # Auth
      post 'auth/login',               to: 'authentication#authenticate'
      post 'auth/signup',              to: 'authentication#signup'
      post 'auth/signup/organization', to: 'authentication#signup_organization'
      post 'auth/signup/user',         to: 'authentication#signup_user'
      post 'auth/switch_tenant',       to: 'authentication#switch_tenant'
      post 'signup',                   to: 'authentication#signup'
      # Health check
      get  'health', to: proc { [200, {}, [{ status: 'ok' }.to_json]] }

      # Upload speed test — capped at 2MB ceiling to protect server resources
      post 'speed_test', to: proc { |env|
        req = Rack::Request.new(env)
        bytes = req.content_length.to_i

        if bytes > 2.megabytes
          [413, { 'Content-Type' => 'application/json' }, [{ error: 'Payload Too Large. Maximum size is 2MB.' }.to_json]]
        else
          [200, { 'Content-Type' => 'application/json' }, [{ received_bytes: bytes }.to_json]]
        end
      }

      # Assessments
      resources :assessments do
        resources :sessions, only: %i[index create] do
          collection do
            post :batch
          end
        end
      end

      # Sessions
      resources :sessions, only: %i[show] do
        member do
          post :end_session
          post :reopen
          get  :coverage
          get  :transcript
          get  :portfolio, to: 'portfolios#show'
          post 'portfolio/regenerate', to: 'portfolios#regenerate'
        end
      end

      # Candidate-facing (no JWT — invite token only)
      get  'sessions/:token/candidate',      to: 'sessions#candidate_info'
      post 'sessions/:token/consent',        to: 'sessions#consent'
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

      # Organization members management
      namespace :organization do
        resources :members, only: %i[index destroy] do
          collection do
            post :invite
          end
        end
      end
    end
  end
end
