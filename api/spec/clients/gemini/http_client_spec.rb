# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::HttpClient do
  describe '#initialize' do
    it 'refuses to build a client while the key is a placeholder' do
      with_env('GEMINI_ENABLED' => 'true', 'GEMINI_API_KEY' => 'placeholder') do
        expect { described_class.new(role: :analysis) }
          .to raise_error(Gemini::Errors::NotConfiguredError, /placeholder/)
      end
    end

    it 'refuses to build a client when no key is present' do
      with_env('GEMINI_ENABLED' => 'true', 'GEMINI_API_KEY' => nil) do
        expect { described_class.new(role: :analysis) }
          .to raise_error(Gemini::Errors::NotConfiguredError, /GEMINI_API_KEY/)
      end
    end

    it 'refuses to build a client when the feature is switched off' do
      with_env('GEMINI_ENABLED' => 'false', 'GEMINI_API_KEY' => "AIza#{'x' * 36}") do
        expect { described_class.new(role: :analysis) }
          .to raise_error(Gemini::Errors::NotConfiguredError, /GEMINI_ENABLED/)
      end
    end

    it 'builds a client when the deployment is configured for live calls' do
      with_env('GEMINI_ENABLED' => 'true', 'GEMINI_API_KEY' => "AIza#{'x' * 36}") do
        expect { described_class.new(role: :analysis) }.not_to raise_error
      end
    end
  end
end
