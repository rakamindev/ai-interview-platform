# frozen_string_literal: true

require 'rails_helper'
require 'stringio'

RSpec.describe AudioWebSocketMiddleware do
  describe '#authenticate_and_load' do
    it 'does not expose internal authentication exception details' do
      middleware = described_class.new(nil)
      env = {
        'HTTP_AUTHORIZATION' => 'Bearer invalid-token',
        'QUERY_STRING' => '',
        'rack.input' => StringIO.new,
        'rack.errors' => StringIO.new,
        'REQUEST_METHOD' => 'GET',
        'PATH_INFO' => '/',
        'rack.url_scheme' => 'http'
      }

      allow(JsonWebToken).to receive(:decode)
        .and_raise(StandardError, 'internal-secret-detail')

      session, error = middleware.send(
        :authenticate_and_load,
        env,
        '123'
      )

      expect(session).to be_nil
      expect(error).to eq('Authentication failed')
      expect(error).not_to include('internal-secret-detail')
    end
  end
end
