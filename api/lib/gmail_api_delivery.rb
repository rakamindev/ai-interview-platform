
# frozen_string_literal: true

require "base64"
require "json"
require "net/http"
require "uri"

# Sends Action Mailer messages using Gmail API over HTTPS.
class GmailApiDelivery
  TOKEN_URL = URI("https://oauth2.googleapis.com/token").freeze
  SEND_URL = URI(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
  ).freeze

  def initialize(_settings = {})
  end

  def deliver!(message)
    access_token = fetch_access_token

    raw_message = Base64.urlsafe_encode64(
      message.encoded,
      padding: false
    )

    request = Net::HTTP::Post.new(SEND_URL)
    request["Authorization"] = "Bearer #{access_token}"
    request["Content-Type"] = "application/json"
    request.body = JSON.generate(raw: raw_message)

    response = perform_request(SEND_URL, request)

    unless response.is_a?(Net::HTTPSuccess)
      raise "Gmail API delivery failed (HTTP #{response.code})"
    end

    result = JSON.parse(response.body)

    if result["id"].to_s.empty?
      raise "Gmail API did not return a message ID"
    end

    Rails.logger.info(
      "[GmailApiDelivery] Email accepted by Gmail API"
    )

    result
  end

  private

  def fetch_access_token
    request = Net::HTTP::Post.new(TOKEN_URL)

    request.set_form_data(
      client_id: ENV.fetch("GMAIL_CLIENT_ID"),
      client_secret: ENV.fetch("GMAIL_CLIENT_SECRET"),
      refresh_token: ENV.fetch("GMAIL_REFRESH_TOKEN"),
      grant_type: "refresh_token"
    )

    response = perform_request(TOKEN_URL, request)

    unless response.is_a?(Net::HTTPSuccess)
      raise "Gmail OAuth token refresh failed (HTTP #{response.code})"
    end

    token = JSON.parse(response.body)["access_token"]

    if token.to_s.empty?
      raise "Gmail OAuth response did not contain an access token"
    end

    token
  end

  def perform_request(uri, request)
    Net::HTTP.start(
      uri.host,
      uri.port,
      use_ssl: true,
      open_timeout: 10,
      read_timeout: 30
    ) do |http|
      http.request(request)
    end
  end
end
