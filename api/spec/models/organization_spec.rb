# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Organization, type: :model do
  describe 'AI configuration and credential resolution' do
    let(:default_org) do
      Organization.create!(
        name: 'Default Org',
        scheme: 'default-org',
        identifier: 'default-org',
        host: 'default.test'
      )
    end

    let(:enterprise_org) do
      Organization.create!(
        name: 'Enterprise Corp',
        scheme: 'enterprise-corp',
        identifier: 'enterprise-corp',
        host: 'enterprise.test',
        config: {
          'ai' => {
            'gemini_api_key' => 'AIzaSyEnterpriseCustomKey123456789',
            'models' => {
              'live' => 'gemini-2.0-flash-exp',
              'flash' => 'gemini-2.0-flash',
              'pro' => 'gemini-2.0-pro-exp-02-05'
            },
            'voice' => 'Aoede',
            'temperature' => 0.4
          }
        }
      )
    end

    describe '#gemini_api_key' do
      it 'returns tenant custom API key when configured' do
        expect(enterprise_org.gemini_api_key).to eq('AIzaSyEnterpriseCustomKey123456789')
        expect(enterprise_org.custom_ai_configured?).to be true
      end

      it 'falls back to system ENV when not configured' do
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with('GEMINI_API_KEY').and_return('ENV_GLOBAL_KEY_999')

        expect(default_org.gemini_api_key).to eq('ENV_GLOBAL_KEY_999')
        expect(default_org.custom_ai_configured?).to be false
      end
    end

    describe '#gemini_model' do
      it 'resolves tenant custom model if configured' do
        expect(enterprise_org.gemini_model(:pro)).to eq('gemini-2.0-pro-exp-02-05')
      end

      it 'falls back to ENV default model when not configured' do
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with('GEMINI_PRO_MODEL').and_return('gemini-2.0-pro-custom-env')

        expect(default_org.gemini_model(:pro)).to eq('gemini-2.0-pro-custom-env')
      end
    end

    describe '#gemini_voice and #gemini_temperature' do
      it 'resolves tenant voice and temperature' do
        expect(enterprise_org.gemini_voice).to eq('Aoede')
        expect(enterprise_org.gemini_temperature).to eq(0.4)
      end

      it 'returns defaults when not configured' do
        expect(default_org.gemini_voice).to eq('Puck')
        expect(default_org.gemini_temperature).to eq(0.2)
      end
    end

    describe '#masked_gemini_api_key' do
      it 'masks tenant key preserving prefix and suffix' do
        masked = enterprise_org.masked_gemini_api_key
        expect(masked).to eq('AIzaSy...6789')
        expect(masked).not_to include('EnterpriseCustomKey')
      end

      it 'returns nil when key is blank' do
        expect(default_org.masked_gemini_api_key).to be_nil
      end

      it 'returns **** for short keys' do
        short_org = Organization.new(
          name: 'Short Key Org',
          scheme: 'short-key',
          identifier: 'short-key',
          host: 'short.test',
          config: { 'ai' => { 'gemini_api_key' => '12345' } }
        )
        expect(short_org.masked_gemini_api_key).to eq('****')
      end
    end

    describe '#update_ai_config!' do
      it 'safely updates tenant AI configuration' do
        default_org.update_ai_config!(
          gemini_api_key: 'AIzaSyNewUpdatedKey987654321',
          voice: 'Charon',
          temperature: 0.7
        )

        reloaded = default_org.reload
        expect(reloaded.gemini_api_key).to eq('AIzaSyNewUpdatedKey987654321')
        expect(reloaded.gemini_voice).to eq('Charon')
        expect(reloaded.gemini_temperature).to eq(0.7)
      end
    end

    describe 'validation' do
      it 'rejects invalid voice options' do
        invalid_org = Organization.new(
          name: 'Invalid Voice Org',
          scheme: 'invalid-voice',
          identifier: 'invalid-voice',
          host: 'invalid.test',
          config: { 'ai' => { 'voice' => 'Robot123' } }
        )
        expect(invalid_org).not_to be_valid
        expect(invalid_org.errors[:config].to_s).to include('voice must be one of')
      end

      it 'rejects temperature out of bounds' do
        invalid_temp = Organization.new(
          name: 'Invalid Temp Org',
          scheme: 'invalid-temp',
          identifier: 'invalid-temp',
          host: 'invalid-temp.test',
          config: { 'ai' => { 'temperature' => 1.5 } }
        )
        expect(invalid_temp).not_to be_valid
        expect(invalid_temp.errors[:config].to_s).to include('temperature must be a numeric value')
      end
    end
  end
end
