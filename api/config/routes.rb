# frozen_string_literal: true

Rails.application.routes.draw do
  HEALTH_LIVE = proc { [200, { "Content-Type" => "application/json" }, [{ status: "ok" }.to_json]] }

  get "/health", to: HEALTH_LIVE

  get "/health/live", to: HEALTH_LIVE

  get "/health/ready", to: proc { |_env|
    checks = {}
    begin
      ActiveRecord::Base.connection.execute("SELECT 1")
      checks[:db] = "ok"
    rescue StandardError => e
      checks[:db] = "error: #{e.message}"
    end
    begin
      Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/1")).ping
      checks[:redis] = "ok"
    rescue StandardError => e
      checks[:redis] = "error: #{e.message}"
    end
    healthy = checks.values.all? { |v| v == "ok" }
    status = healthy ? 200 : 503
    body = { status: healthy ? "ok" : "degraded", checks: checks }
    [status, { "Content-Type" => "application/json" }, [body.to_json]]
  }

  namespace :api do
    namespace :v1 do
      # Auth
      post "auth/login", to: "authentication#authenticate"
      post "auth/refresh", to: "authentication#refresh"
      delete "auth/logout", to: "authentication#logout"
      post "auth/invites", to: "invites#create"
      post "auth/accept_invite", to: "invites#accept"
      # Health check
      get  "health", to: HEALTH_LIVE

      # Upload speed test — accepts any payload, discards it, returns bytes received
      post "speed_test", to: proc { |env|
        bytes = env["CONTENT_LENGTH"].to_i
        [200, { "Content-Type" => "application/json" }, [{ received_bytes: bytes }.to_json]]
      }

      # Assessments
      resources :assessments do
        resources :sessions, only: %i[index create] do
          collection do
            post :bulk_create
          end
        end
      end

      # Sessions
      resources :sessions, only: %i[show] do
        member do
          post :end_session
          get  :coverage
          get  :transcript
          get  :portfolio, to: "portfolios#show"
          post "portfolio/regenerate", to: "portfolios#regenerate"
        end
      end

      # Candidate-facing (no JWT — invite token only)
      get  "sessions/:token/candidate",      to: "sessions#candidate_info"
      post "sessions/:token/audio_complete", to: "sessions#audio_complete"

      # Portfolio skills overrides
      resources :portfolio_skills, only: [] do
        member do
          post :override
          resources :override_events, only: %i[index]
        end
      end

      # Tenant-wide override audit log (Audit Override History page)
      get "override_events", to: "override_events#audit"

      # B7 Skill Taxonomy (read-only reference data)
      get  "skill_taxonomies", to: "skill_taxonomies#index"
      get  "skill_taxonomies/:skill_id", to: "skill_taxonomies#show", as: :skill_taxonomy

      # Vacancies
      resources :vacancies

      # Portfolios — fit/gap and export
      resources :portfolios, only: [] do
        member do
          post :fitgap
          post :regenerate_fitgap
          get  "fitgap/:vacancy_id", to: "portfolios#show_fitgap", as: :fitgap_vacancy
          get  :export
        end
      end
    end
  end
end
