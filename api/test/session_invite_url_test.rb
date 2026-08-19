# frozen_string_literal: true

require "minitest/autorun"
require_relative "../config/environment"

class SessionInviteUrlTest < Minitest::Test
  def test_invite_url_points_to_the_frontend_interview_route
    previous = ENV["WEB_BASE_URL"]
    ENV["WEB_BASE_URL"] = "http://frontend.test"

    session = Session.new(invite_token: "token-123")

    assert_equal "http://frontend.test/interview/token-123", session.invite_url
  ensure
    ENV["WEB_BASE_URL"] = previous
  end

  def test_invite_url_uses_safe_local_default
    previous = ENV.delete("WEB_BASE_URL")

    session = Session.new(invite_token: "token-123")

    assert_equal "http://localhost:5173/interview/token-123", session.invite_url
  ensure
    ENV["WEB_BASE_URL"] = previous
  end

  def test_invite_url_removes_trailing_slash_from_frontend_base
    previous = ENV["WEB_BASE_URL"]
    ENV["WEB_BASE_URL"] = "http://frontend.test/"

    session = Session.new(invite_token: "token-123")

    assert_equal "http://frontend.test/interview/token-123", session.invite_url
  ensure
    ENV["WEB_BASE_URL"] = previous
  end
end
