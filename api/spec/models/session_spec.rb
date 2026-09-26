# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session do
  describe '#outcome' do
    {
      'all_covered'      => 'completed',
      'time_ceiling'     => 'completed',
      'manual_candidate' => 'ended_early',
      'manual_assessor'  => 'ended_early',
      'error'            => 'failed'
    }.each do |reason, outcome|
      it "is #{outcome} when the interview ended with #{reason}" do
        expect(described_class.new(status: 'ended', end_reason: reason).outcome).to eq(outcome)
      end
    end

    it 'is nil until the interview ends' do
      expect(described_class.new(status: 'pending').outcome).to be_nil
      expect(described_class.new(status: 'active').outcome).to be_nil
    end

    it 'is failed for a failed session, and never completed without a known reason' do
      expect(described_class.new(status: 'failed').outcome).to eq('failed')
      expect(described_class.new(status: 'ended', end_reason: nil).outcome).to eq('ended_early')
    end
  end

  describe '#invite_url' do
    subject(:url) { described_class.new(invite_token: 'abc123').invite_url }

    it 'points at the web app, where the candidate page lives' do
      with_env('WEB_APP_URL' => 'https://app.example.com', 'APP_BASE_URL' => 'https://api.example.com') do
        expect(url).to eq('https://app.example.com/interview/abc123')
      end
    end

    it 'still reads the old APP_BASE_URL name' do
      with_env('WEB_APP_URL' => nil, 'APP_BASE_URL' => 'https://app.example.com') do
        expect(url).to eq('https://app.example.com/interview/abc123')
      end
    end

    it 'defaults to the local web app, not the API' do
      with_env('WEB_APP_URL' => nil, 'APP_BASE_URL' => nil) do
        expect(url).to eq('http://localhost:5173/interview/abc123')
      end
    end

    it 'does not double the slash when the URL ends with one' do
      with_env('WEB_APP_URL' => 'https://app.example.com/') do
        expect(url).to eq('https://app.example.com/interview/abc123')
      end
    end
  end
end
