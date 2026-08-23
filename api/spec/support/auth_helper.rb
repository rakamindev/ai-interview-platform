# frozen_string_literal: true

module AuthHelper
  # Also ensures a Membership row exists for user/scheme's org, since
  # verify_scheme_claim! (API-NEW-01) now hard-requires one — a spec that
  # builds a JWT without a backing membership would otherwise always 401.
  def jwt_for(user:, scheme:)
    org = Organization.find_by(scheme: scheme)
    if org
      Membership.find_or_create_by!(user_id: user.id, organization_id: org.id) do |m|
        m.role = user.role
      end
    end

    token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: scheme)
    { "Authorization" => "Bearer #{token}" }
  end
end
