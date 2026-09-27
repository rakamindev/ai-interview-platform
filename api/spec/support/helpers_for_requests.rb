# frozen_string_literal: true

module HelpersForRequests
  JSON_HEADERS = { 'Content-Type' => 'application/json', 'Accept' => 'application/json' }.freeze

  def get_json(url, body = {}, headers = {})
    get url, params: body, headers: headers.reverse_merge(JSON_HEADERS)
  end

  def post_json(url, body = {}, headers = {})
    post url, params: body.to_json, headers: headers.reverse_merge(JSON_HEADERS)
  end

  def put_json(url, body = {}, headers = {})
    put url, params: body.to_json, headers: headers.reverse_merge(JSON_HEADERS)
  end

  def as_admin(organization)
    bearer(token_for(organization, 'admin'))
  end

  def as_user(organization)
    bearer(token_for(organization, 'user'))
  end

  def bearer(token)
    { 'Authorization' => "Bearer #{token}" }
  end

  def response_body
    JSON.parse(response.body)
  end

  private

  def token_for(organization, role)
    JsonWebToken.encode({ user_id: 1, role: role, scheme: organization.scheme })
  end
end

RSpec.configure do |config|
  config.include HelpersForRequests, type: :request
end
