# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::HttpClient do
  let(:custom_org) do
    Organization.create!(
      name: 'Custom HTTP Org',
      scheme: 'custom-http-org',
      identifier: 'custom-http-org',
      host: 'custom-http.test',
      config: {
        'ai' => {
          'gemini_api_key' => 'AIzaSyHttpTenantCustomKey',
          'models' => {
            'pro' => 'gemini-tenant-pro-custom'
          }
        }
      }
    )
  end

  let(:default_org) do
    Organization.create!(
      name: 'Default HTTP Org',
      scheme: 'default-http-org',
      identifier: 'default-http-org',
      host: 'default-http.test'
    )
  end

  describe '#initialize' do
    it 'injects tenant-specific credentials and pro model from organization' do
      client = described_class.new(organization: custom_org)

      expect(client.api_key).to eq('AIzaSyHttpTenantCustomKey')
      expect(client.model).to eq('gemini-tenant-pro-custom')
    end

    it 'falls back to ENV when organization has no custom config' do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with('GEMINI_API_KEY').and_return('ENV_GLOBAL_KEY_HTTP')
      allow(ENV).to receive(:[]).with('GEMINI_PRO_MODEL').and_return('gemini-env-pro')

      client = described_class.new(organization: default_org)

      expect(client.api_key).to eq('ENV_GLOBAL_KEY_HTTP')
      expect(client.model).to eq('gemini-env-pro')
    end

    it 'allows explicit parameters to override organization config' do
      client = described_class.new(
        organization: custom_org,
        api_key: 'AIzaSyExplicitHttpKey',
        model: 'explicit-model-pro'
      )

      expect(client.api_key).to eq('AIzaSyExplicitHttpKey')
      expect(client.model).to eq('explicit-model-pro')
    end
  end

  describe '#generate_content' do
    let(:client) { described_class.new(organization: custom_org) }

    it 'sends JSON mime type and maxOutputTokens in generationConfig' do
      connection = client.instance_variable_get(:@connection)

      expect(connection).to receive(:post) do |_url, body, _headers|
        parsed_body = JSON.parse(body)
        config = parsed_body['generationConfig']
        expect(config['responseMimeType']).to eq('application/json')
        expect(config['maxOutputTokens']).to eq(8192)
        expect(config['temperature']).to eq(0.2)

        double(
          success?: true,
          status: 200,
          body: {
            candidates: [
              { content: { parts: [{ text: '{"configured_skills":[]}' }] } }
            ]
          }.to_json
        )
      end

      result = client.generate_content('test prompt')
      expect(result).to eq({ 'configured_skills' => [] })
    end

    it 'parses and strips markdown code fences from the response' do
      connection = client.instance_variable_get(:@connection)
      fenced_payload = "```json\n{\"skills\": [\"React\"]}\n```"

      allow(connection).to receive(:post).and_return(
        double(
          success?: true,
          status: 200,
          body: {
            candidates: [
              { content: { parts: [{ text: fenced_payload }] } }
            ]
          }.to_json
        )
      )

      result = client.generate_content('test prompt')
      expect(result).to eq({ 'skills' => ['React'] })
    end

    it 'repairs truncated JSON payloads with open string quotes and unclosed braces' do
      connection = client.instance_variable_get(:@connection)
      # Truncated JSON missing closing quote and closing bracket/brace
      truncated_payload = '{"configured_skills": [{"skill_id": "sk-1", "evidence": ["truncated quote'

      allow(connection).to receive(:post).and_return(
        double(
          success?: true,
          status: 200,
          body: {
            candidates: [
              { content: { parts: [{ text: truncated_payload }] } }
            ]
          }.to_json
        )
      )

      result = client.generate_content('test prompt')
      expect(result).to be_a(Hash)
      expect(result.dig('configured_skills', 0, 'skill_id')).to eq('sk-1')
    end
  end
end
