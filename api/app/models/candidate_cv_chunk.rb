# frozen_string_literal: true

class CandidateCvChunk < ApplicationRecord
  include TenantScoped

  belongs_to :session
  belongs_to :tenant, class_name: 'Organization', foreign_key: :tenant_id, optional: true

  before_validation :assign_tenant_from_session, on: :create, prepend: true

  validates :chunk_index, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :content, presence: true
  validates :chunk_index, uniqueness: { scope: :session_id }

  scope :ordered, -> { order(:chunk_index) }

  # Sub-5ms cosine nearest-neighbor query utilizing PostgreSQL pgvector HNSW index.
  # Formats float array into safe vector string [0.123, -0.456, ...] before ordering by `<=>`.
  def self.nearest_to(embedding_vector, limit: 2)
    vector_string = '[' + Array(embedding_vector).map(&:to_f).join(',') + ']'
    order(Arel.sql("embedding <=> '#{vector_string}'")).limit(limit)
  end

  # Returns array of floats from PostgreSQL vector representation.
  def embedding_array
    return [] if embedding.blank?
    return embedding if embedding.is_a?(Array)

    embedding.to_s.tr('[]', '').split(',').map(&:to_f)
  end

  private

  def assign_tenant_from_session
    self.tenant_id ||= session&.tenant_id
  end
end
