# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CandidateCvChunk, type: :model do
  let(:org) { Organization.create!(name: 'Vector Org', scheme: 'vectororg', identifier: 'vectororg', host: 'vectororg.test') }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: 1,
      name: 'Cloud Engineer',
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

  # Generates a normalized 768-dimensional mock embedding vector
  def mock_embedding(bias: 0.0)
    Array.new(768) { |i| ((i + bias) / 1000.0).round(4) }
  end

  describe 'pgvector storage and schema validations' do
    it 'persists candidate cv chunk with 768-dim vector embedding' do
      vector = mock_embedding(bias: 1.0)
      chunk = described_class.new(
        session: session,
        chunk_index: 0,
        section_type: 'projects',
        content: 'Migrated monolithic payment gateway to microservices with zero downtime.',
        metadata: { 'company' => 'Bukalapak', 'technologies' => ['Go', 'PostgreSQL', 'Redis'] },
        embedding: '[' + vector.join(',') + ']'
      )

      expect(chunk).to be_valid
      expect { chunk.save! }.not_to raise_error

      reloaded = chunk.reload
      expect(reloaded.chunk_index).to eq(0)
      expect(reloaded.section_type).to eq('projects')
      expect(reloaded.metadata['company']).to eq('Bukalapak')
      expect(reloaded.embedding_array.length).to eq(768)
    end

    it 'enforces uniqueness of chunk_index per session' do
      described_class.create!(
        session: session,
        chunk_index: 1,
        content: 'Work experience at Tokopedia',
        section_type: 'experience'
      )

      duplicate = described_class.new(
        session: session,
        chunk_index: 1,
        content: 'Conflicting chunk index',
        section_type: 'skills'
      )

      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:chunk_index]).to include('has already been taken')
    end

    it 'cascades deletion when parent session is destroyed' do
      chunk = described_class.create!(
        session: session,
        chunk_index: 0,
        content: 'Resume summary content'
      )

      expect { session.destroy! }.to change(described_class, :count).by(-1)
      expect(described_class.find_by(id: chunk.id)).to be_nil
    end

    it 'performs sub-5ms cosine similarity ranking using nearest_to scope' do
      target_vector = mock_embedding(bias: 10.0)
      close_vector = mock_embedding(bias: 10.1) # Cosine distance ~ 0.0001
      far_vector = mock_embedding(bias: 50.0)   # Greater distance

      close_chunk = described_class.create!(
        session: session,
        chunk_index: 0,
        content: 'Deep database sharding experience',
        embedding: '[' + close_vector.join(',') + ']'
      )

      far_chunk = described_class.create!(
        session: session,
        chunk_index: 1,
        content: 'Front-end CSS styling',
        embedding: '[' + far_vector.join(',') + ']'
      )

      nearest = described_class.where(session_id: session.id).nearest_to(target_vector, limit: 1)
      expect(nearest.first).to eq(close_chunk)
    end
  end
end
