# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe '#invite_url' do
    let(:session) { described_class.new(invite_token: 'abc123') }

    def with_env(overrides)
      keys = overrides.keys.map(&:to_s)
      saved = keys.index_with { |k| ENV.fetch(k, nil) }
      overrides.each { |k, v| v.nil? ? ENV.delete(k.to_s) : ENV[k.to_s] = v }
      yield
    ensure
      saved.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
    end

    it 'uses WEB_APP_BASE_URL when set' do
      with_env('WEB_APP_BASE_URL' => 'http://localhost:5173', 'ALLOWED_ORIGINS' => nil) do
        expect(session.invite_url).to eq('http://localhost:5173/interview/abc123')
      end
    end

    it 'falls back to first ALLOWED_ORIGINS entry when WEB_APP_BASE_URL is blank' do
      with_env('WEB_APP_BASE_URL' => nil, 'ALLOWED_ORIGINS' => 'http://localhost:5173,http://app.test') do
        expect(session.invite_url).to eq('http://localhost:5173/interview/abc123')
      end
    end

    it 'defaults to localhost:5173 when no env is configured' do
      with_env('WEB_APP_BASE_URL' => nil, 'ALLOWED_ORIGINS' => '*') do
        expect(session.invite_url).to eq('http://localhost:5173/interview/abc123')
      end
    end
  end
end
