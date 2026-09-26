# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::Models do
  let(:no_model_vars) { { 'GEMINI_LIVE_MODEL' => nil, 'GEMINI_FLASH_MODEL' => nil, 'GEMINI_PRO_MODEL' => nil } }

  it 'uses model names that exist today when no env var is set' do
    with_env(no_model_vars) do
      expect(described_class.live).to eq('gemini-3.1-flash-live-preview')
      expect(described_class.flash).to eq('gemini-2.5-flash')
      expect(described_class.pro).to eq('gemini-3.6-flash')
    end
  end

  it 'uses the env var when one is set' do
    with_env('GEMINI_PRO_MODEL' => 'another-model') do
      expect(described_class.pro).to eq('another-model')
    end
  end

  it 'ignores an empty env var' do
    with_env('GEMINI_FLASH_MODEL' => '') do
      expect(described_class.flash).to eq('gemini-2.5-flash')
    end
  end

  it 'matches the sample config, so a new setup gets working names' do
    sample = YAML.load_file(Rails.root.join('config/application.yml.sample'))

    expect(sample.values_at('GEMINI_LIVE_MODEL', 'GEMINI_FLASH_MODEL', 'GEMINI_PRO_MODEL'))
      .to eq(described_class::DEFAULTS.values_at(:live, :flash, :pro))
  end
end
