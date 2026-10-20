# frozen_string_literal: true

# Settings production must not start without. Each closes a risk that a missing or wrong value would open
# silently, so boot fails and says why instead.
#   GEMINI_TIER=paid      The free tier may use inputs to improve Google's products, and its terms say not to send
#                         personal information. A candidate's interview is personal information.
#   LOGIN_TENANT_SCHEME   Users don't belong to a company yet (C2), so the server names the one this deployment
#                         serves, rather than whatever the login request asks for.
#   APP_BASE_URL          The web app candidates open. Invite links are built from it; unset, every link would
#                         point at localhost.
module ProductionGuards
  module_function

  def problems(env = ENV)
    found = []
    unless env['GEMINI_TIER'] == 'paid'
      found << "GEMINI_TIER must be 'paid': the free tier may reuse what candidates say (got #{env['GEMINI_TIER'].inspect})"
    end
    if env['LOGIN_TENANT_SCHEME'].to_s.strip.empty?
      found << 'LOGIN_TENANT_SCHEME must name the company this deployment serves (users belong to no company yet, C2)'
    end
    if env['APP_BASE_URL'].to_s.strip.empty?
      found << 'APP_BASE_URL must be the web app URL candidates open: invite links are built from it'
    end
    found
  end

  def check!(env = ENV)
    found = problems(env)
    raise "Refusing to start in production: #{found.join('; ')}" if found.any?
  end
end
