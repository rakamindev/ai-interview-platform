# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::Config do
  describe '.key_state' do
    it 'is :missing when no key is present' do
      with_env('GEMINI_API_KEY' => nil) do
        expect(described_class.key_state).to eq(:missing)
      end
    end

    it 'is :placeholder for short or template-shaped values' do
      with_env('GEMINI_API_KEY' => 'placeholder') do
        expect(described_class.key_state).to eq(:placeholder)
      end

      with_env('GEMINI_API_KEY' => "your-google-ai-studio-key-goes-here") do
        expect(described_class.key_state).to eq(:placeholder)
      end
    end

    it 'is :set for a syntactically real key' do
      with_env('GEMINI_API_KEY' => "AIza#{'x' * 36}") do
        expect(described_class.key_state).to eq(:set)
      end
    end
  end

  describe '.enabled?' do
    it 'treats an unset variable as enabled' do
      with_env('GEMINI_ENABLED' => nil) do
        expect(described_class.enabled?).to be(true)
      end
    end

    %w[false 0 no off].each do |value|
      it "treats #{value} as disabled" do
        with_env('GEMINI_ENABLED' => value) do
          expect(described_class.enabled?).to be(false)
        end
      end
    end
  end

  describe '.by_role' do
    it 'returns the documented defaults for a known role' do
      with_env('GEMINI_TIMEOUT_PORTFOLIO' => nil, 'GEMINI_RETRY_MAX_PORTFOLIO' => nil) do
        expect(described_class.by_role(:portfolio)).to include(model: 'gemini-3.6-flash', timeout: 180)
      end
    end

    it 'lets the environment override timeout and retry budget' do
      with_env('GEMINI_TIMEOUT_PORTFOLIO' => '7', 'GEMINI_RETRY_MAX_PORTFOLIO' => '0') do
        expect(described_class.by_role(:portfolio)).to include(timeout: 7, retry_max: 0)
      end
    end

    it 'rejects unknown roles instead of guessing' do
      expect { described_class.by_role(:nope) }.to raise_error(ArgumentError, /Unknown Gemini role/)
    end
  end

  describe '.safe_message' do
    it 'flattens newlines and truncates long messages' do
      message = described_class.safe_message("line one\nline two #{'x' * 500}", limit: 40)

      expect(message).not_to include("\n")
      expect(message.length).to be <= 41
    end

    it 'keeps the class for an exception so failures stay diagnosable' do
      error = Gemini::Errors::InvalidResponseError.new('bad payload')

      expect(described_class.safe_message(error)).to start_with('Gemini::Errors::InvalidResponseError:')
    end
  end

  describe '.diagnostics' do
    it 'never includes the API key value' do
      with_env('GEMINI_API_KEY' => "AIza#{'s' * 36}", 'GEMINI_ENABLED' => 'true') do
        dump = described_class.diagnostics.to_s

        expect(dump).to include('set')
        expect(dump).not_to include('AIzass')
      end
    end
  end
end
