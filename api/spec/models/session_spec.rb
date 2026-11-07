# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe '#invite_url' do
    around do |example|
      original_url = Rails.configuration.x.web_base_url
      Rails.configuration.x.web_base_url = 'https://web.example.com'
      example.run
    ensure
      Rails.configuration.x.web_base_url = original_url
    end

    it 'uses the validated public web origin and candidate route' do
      session = described_class.new(invite_token: 'candidate-token')

      expect(session.invite_url).to eq(
        'https://web.example.com/interview/candidate-token'
      )
    end
  end
end
