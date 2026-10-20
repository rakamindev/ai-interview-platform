# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Cv::ChunkingService do
  let(:org) { Organization.create!(name: 'Chunk Org', scheme: 'chunkorg', identifier: 'chunkorg', host: 'chunkorg.test') }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: 1,
      name: 'Fullstack Architect',
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

  let(:sample_cv_text) do
    <<~CV
      John Doe
      Senior Backend Engineer

      SUMMARY
      Passionate systems architect with 8+ years building high-throughput payment infrastructures and cloud systems.

      WORK EXPERIENCE
      Bukalapak - Senior Backend Engineer (2021 - Present)
      Led migration of core checkout monolithic system to distributed Go microservices handling 45,000 requests per second.
      Engineered event-driven order processing pipeline utilizing Kafka and PostgreSQL partitioned tables.
      Reduced P99 checkout latency from 850ms down to 120ms with Redis distributed caching.

      Gojek - Software Engineer (2018 - 2021)
      Developed scalable dispatch routing engine using Ruby on Rails and Redis geospatial indexes.
      Integrated Docker and Kubernetes CI/CD workflows on Google Cloud Platform (GCP).

      KEY PROJECTS
      Zero-Downtime Database Migration
      Migrated 2.4 TB relational PostgreSQL database across AWS regions using logical replication with zero dropped transactions.

      TECHNICAL SKILLS
      Languages: Go, Ruby, Python, TypeScript
      Databases & Messaging: PostgreSQL, Redis, Kafka, Elasticsearch
      Infrastructure: Docker, Kubernetes, Terraform, AWS, GCP
    CV
  end

  describe '.call' do
    it 'splits CV into semantic project and experience chunks with metadata' do
      chunks = described_class.call(sample_cv_text)

      expect(chunks).to be_an(Array)
      expect(chunks.length).to be >= 3

      experience_chunk = chunks.find { |c| c[:section_type] == 'experience' }
      expect(experience_chunk).to be_present
      expect(experience_chunk[:content]).to include('Bukalapak')
      expect(experience_chunk[:metadata]['technologies']).to include('Go', 'Kafka', 'PostgreSQL', 'Redis')

      skills_chunk = chunks.find { |c| c[:section_type] == 'skills' }
      expect(skills_chunk).to be_present
      expect(skills_chunk[:metadata]['technologies']).to include('Docker', 'Kubernetes', 'Terraform')
    end

    it 'persists candidate cv chunks into database when session is passed' do
      expect do
        described_class.call(sample_cv_text, session: session)
      end.to change(session.candidate_cv_chunks, :count).by_at_least(3)

      saved_chunks = session.candidate_cv_chunks.ordered
      expect(saved_chunks.first.chunk_index).to eq(0)
      expect(saved_chunks.pluck(:chunk_index)).to eq((0...saved_chunks.count).to_a)
    end
  end
end
