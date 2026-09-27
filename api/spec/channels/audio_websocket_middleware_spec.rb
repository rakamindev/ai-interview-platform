# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware do
  let(:app) { ->(env) { [200, env, ['OK']] } }
  let(:middleware) { described_class.new(app) }

  describe '#sanitize_output_transcription' do
    subject(:sanitized) { middleware.send(:sanitize_output_transcription, text) }

    context 'when text contains clean AI output' do
      let(:text) { 'Menarik sekali, bagaimana Anda menangani respon dari LLM jika error?' }

      it 'returns the text unchanged' do
        expect(sanitized).to eq('Menarik sekali, bagaimana Anda menangani respon dari LLM jika error?')
      end
    end

    context 'when text contains [COVERAGE_MAP] tags and JSON' do
      let(:text) do
        <<~TEXT
          [COVERAGE_MAP]
          {"skills":[{"id":"react","state":"covered"}],"pacing":"ahead"}
          [/COVERAGE_MAP]
          Bagaimana cara Anda mengelola state di React?
        TEXT
      end

      it 'strips the coverage map block' do
        expect(sanitized).to eq('Bagaimana cara Anda mengelola state di React?')
      end
    end

    context 'when text contains [COVERAGE MAP] with a space' do
      let(:text) do
        <<~TEXT
          [COVERAGE MAP]
          {"skills":[{"id":"node","state":"partial"}]}
          [/COVERAGE MAP]
          Bisa jelaskan arsitektur backend Anda?
        TEXT
      end

      it 'strips the coverage map block' do
        expect(sanitized).to eq('Bisa jelaskan arsitektur backend Anda?')
      end
    end

    context 'when text leaks Pacing info and Current goal prefix' do
      let(:text) do
        <<~TEXT
          Pacing info: pacing=ahead. Keep probing skills. Current goal: probe further into node.

          Menarik, pakai Supabase Edge Functions untuk memanggil LLM agar API key-nya aman. Nah, di edge function itu, bagaimana cara Anda menangani respon dari LLM kalau misalnya terjadi error atau timeout? Apakah ada mekanisme retry atau fallback data yang Anda terapkan?
        TEXT
      end

      it 'strips the Pacing info and Current goal preamble' do
        expected = 'Menarik, pakai Supabase Edge Functions untuk memanggil LLM agar API key-nya aman. Nah, di edge function itu, bagaimana cara Anda menangani respon dari LLM kalau misalnya terjadi error atau timeout? Apakah ada mekanisme retry atau fallback data yang Anda terapkan?'
        expect(sanitized).to eq(expected)
      end
    end

    context 'when text leaks Pacing info with initial question goal' do
      let(:text) do
        "Pacing info: pacing=ahead. Keep probing skills. Current goal: initial question for skill react.\n\nWah, menarik banget aplikasinya!"
      end

      it 'strips the Pacing info preamble' do
        expect(sanitized).to eq('Wah, menarik banget aplikasinya!')
      end
    end

    context 'when text leaks Pacing info with all covered goal' do
      let(:text) do
        "Pacing info: pacing=ahead. Keep probing skills. Current goal: all covered.\n\nAnalisis yang bagus tentang trade off antara serverless dan server tradisional."
      end

      it 'strips the Pacing info preamble' do
        expect(sanitized).to eq('Analisis yang bagus tentang trade off antara serverless dan server tradisional.')
      end
    end

    context 'when text contains both [COVERAGE MAP] and Pacing info preamble' do
      let(:text) do
        <<~TEXT
          [COVERAGE MAP]
          {
            "skills": [
              { "id": "react", "state": "partial" }
            ],
            "pacing": "ahead"
          }
          [/COVERAGE MAP]
          Pacing info: pacing=ahead. Keep probing skills. Current goal: probe further into node.

          Menarik, bagaimana cara menangani error?
        TEXT
      end

      it 'strips both the coverage map and the pacing info preamble' do
        expect(sanitized).to eq('Menarik, bagaimana cara menangani error?')
      end
    end
  end
end
