# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::LiveClient do
  let(:custom_org) do
    Organization.create!(
      name: 'Acme Enterprise',
      scheme: 'acme-enterprise',
      identifier: 'acme-enterprise',
      host: 'acme.test',
      config: {
        'ai' => {
          'gemini_api_key' => 'AIzaSyAcmeCustomEnterpriseKey',
          'models' => {
            'live' => 'gemini-custom-live-model'
          },
          'voice' => 'Fenrir'
        }
      }
    )
  end

  let(:default_org) do
    Organization.create!(
      name: 'Default Org',
      scheme: 'default-live-org',
      identifier: 'default-live-org',
      host: 'default-live.test'
    )
  end

  describe '#initialize' do
    it 'injects tenant-specific credentials, model, and voice from organization' do
      client = described_class.new(
        organization: custom_org,
        system_prompt: 'Test prompt'
      )

      expect(client.api_key).to eq('AIzaSyAcmeCustomEnterpriseKey')
      expect(client.model).to eq('gemini-custom-live-model')
      expect(client.voice).to eq('Fenrir')
      expect(client.language).to eq('id')
    end

    it 'falls back to ENV and default voice when organization has no custom AI config' do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with('GEMINI_API_KEY').and_return('ENV_GLOBAL_KEY')
      allow(ENV).to receive(:[]).with('GEMINI_LIVE_MODEL').and_return('gemini-env-live')

      client = described_class.new(
        organization: default_org,
        system_prompt: 'Test prompt'
      )

      expect(client.api_key).to eq('ENV_GLOBAL_KEY')
      expect(client.model).to eq('gemini-env-live')
      expect(client.voice).to eq('Puck')
    end

    it 'allows explicit parameters to override organization configuration' do
      client = described_class.new(
        organization: custom_org,
        api_key: 'AIzaSyExplicitOverrideKey',
        model: 'explicit-model-name',
        voice: 'Charon',
        language: 'en',
        system_prompt: 'Test prompt'
      )

      expect(client.api_key).to eq('AIzaSyExplicitOverrideKey')
      expect(client.model).to eq('explicit-model-name')
      expect(client.voice).to eq('Charon')
      expect(client.language).to eq('en')
    end
  end

  describe '#send_setup' do
    let(:client_id) do
      described_class.new(
        organization: custom_org,
        system_prompt: 'Assessment in Indonesian',
        language: 'id'
      )
    end

    let(:client_en) do
      described_class.new(
        organization: custom_org,
        system_prompt: 'Assessment in English',
        language: 'en'
      )
    end

    it 'configures inputAudioTranscription with bilingual hints for Indonesian' do
      mock_ws = instance_double(Faye::WebSocket::Client)
      client_id.instance_variable_set(:@ws, mock_ws)

      expect(mock_ws).to receive(:send) do |json_str|
        payload = JSON.parse(json_str)
        tx_config = payload.dig('setup', 'inputAudioTranscription')
        expect(tx_config['languageCodes']).to eq(['id-ID', 'en-US'])
      end

      client_id.send(:send_setup)
    end

    it 'configures inputAudioTranscription with en-US hint for English' do
      mock_ws = instance_double(Faye::WebSocket::Client)
      client_en.instance_variable_set(:@ws, mock_ws)

      expect(mock_ws).to receive(:send) do |json_str|
        payload = JSON.parse(json_str)
        tx_config = payload.dig('setup', 'inputAudioTranscription')
        expect(tx_config['languageCodes']).to eq(['en-US'])
      end

      client_en.send(:send_setup)
    end
  end
end
