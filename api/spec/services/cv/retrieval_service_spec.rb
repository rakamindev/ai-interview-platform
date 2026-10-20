# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Cv::RetrievalService do
  let(:org) { Organization.create!(name: 'RAG Org', scheme: 'ragorg', identifier: 'ragorg', host: 'ragorg.test') }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: 1,
      name: 'Backend Tech Lead',
      time_limit_min: 30
    )
  end
  let(:session) do
    Session.create!(
      tenant_id: org.id,
      assessment: assessment,
      invite_token: SecureRandom.hex(16),
      status: :active
    )
  end

  before do
    Current.tenant_id = org.id
  end

  def mock_embedding(bias: 0.0)
    Array.new(768) { |i| ((i + bias) / 1000.0).round(4) }
  end

  let(:mock_client) do
    instance_double(Gemini::EmbeddingClient).tap do |client|
      allow(client).to receive(:embed).and_return(mock_embedding(bias: 1.0))
    end
  end

  describe '.call' do
    context 'when input parameters are invalid or empty' do
      it 'returns failure when session is nil' do
        result = described_class.call(session: nil, query: 'PostgreSQL')
        expect(result.success?).to be false
        expect(result.chunks).to be_empty
        expect(result.directive).to be_nil
      end

      it 'returns failure when query is blank' do
        result = described_class.call(session: session, query: '   ')
        expect(result.success?).to be false
        expect(result.chunks).to be_empty
        expect(result.directive).to be_nil
      end

      it 'returns failure when session has no candidate cv chunks' do
        result = described_class.call(session: session, query: 'PostgreSQL', embedding_client: mock_client)
        expect(result.success?).to be false
        expect(result.chunks).to be_empty
        expect(result.directive).to be_nil
      end
    end

    context 'with existing CV chunks in database' do
      let!(:chunk_db) do
        CandidateCvChunk.create!(
          session: session,
          chunk_index: 0,
          section_type: 'projects',
          content: 'Architected high-throughput payment processing on PostgreSQL and Kafka.',
          metadata: { 'company' => 'Gojek' },
          embedding: '[' + mock_embedding(bias: 1.0).join(',') + ']'
        )
      end

      let!(:chunk_fe) do
        CandidateCvChunk.create!(
          session: session,
          chunk_index: 1,
          section_type: 'experience',
          content: 'Built responsive design systems with React and Tailwind CSS.',
          metadata: { 'company' => 'Traveloka' },
          embedding: '[' + mock_embedding(bias: 5.0).join(',') + ']'
        )
      end

      it 'retrieves the most semantically relevant chunks and formats directive' do
        result = described_class.call(
          session: session,
          query: 'Database architecture',
          limit: 1,
          embedding_client: mock_client
        )

        expect(result.success?).to be true
        expect(result.chunks.size).to eq(1)
        expect(result.chunks.first.id).to eq(chunk_db.id)
        expect(result.directive).to include('CANDIDATE CV EVIDENCE:')
        expect(result.directive).to include('At Gojek:')
        expect(result.directive).to include('Architected high-throughput payment processing')
        expect(result.directive).to include('DIRECTIVE: When probing "Database architecture"')
      end

      it 'defensively catches external client errors and returns empty result' do
        failing_client = instance_double(Gemini::EmbeddingClient)
        allow(failing_client).to receive(:embed).and_raise(Gemini::HttpClient::RateLimitError.new('Rate limited'))

        result = described_class.call(
          session: session,
          query: 'Database architecture',
          embedding_client: failing_client
        )

        expect(result.success?).to be false
        expect(result.chunks).to be_empty
        expect(result.directive).to be_nil
      end
    end
  end
end
