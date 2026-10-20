# frozen_string_literal: true

module Cv
  # Sub-5ms Micro-RAG retriever that fetches candidate past project evidence
  # and formats targeted context directives for live interview probing.
  class RetrievalService
    Result = Struct.new(:chunks, :directive, :success?, keyword_init: true)

    def self.call(session:, query:, limit: 2, embedding_client: nil)
      new(session: session, query: query, limit: limit, embedding_client: embedding_client).call
    end

    def initialize(session:, query:, limit: 2, embedding_client: nil)
      @session = session
      @query = query.to_s.strip
      @limit = limit
      @embedding_client = embedding_client
    end

    def call
      return empty_result if @session.nil? || @query.blank?

      chunks_scope = @session.candidate_cv_chunks
      return empty_result if chunks_scope.empty?

      embedding = fetch_query_embedding
      return empty_result if embedding.blank?

      # PostgreSQL pgvector HNSW cosine similarity search (< 5ms)
      retrieved_chunks = chunks_scope.nearest_to(embedding, limit: @limit).to_a
      return empty_result if retrieved_chunks.empty?

      directive = format_directive(retrieved_chunks)
      Result.new(chunks: retrieved_chunks, directive: directive, success?: true)
    rescue => e
      Rails.logger.warn("[Cv::RetrievalService] Retrieval failed for query '#{@query}': #{e.message}")
      empty_result
    end

    private

    def fetch_query_embedding
      client = @embedding_client || default_embedding_client
      client.embed(@query)
    end

    def default_embedding_client
      tenant = @session.tenant || @session.assessment&.tenant || Organization.find_by(id: @session.tenant_id)
      Gemini::EmbeddingClient.new(organization: tenant)
    end

    def format_directive(chunks)
      highlights = chunks.map do |c|
        company = c.metadata['company'].presence
        prefix = company ? "At #{company}: " : ''
        "- #{prefix}#{c.content.truncate(200)}"
      end.join("\n")

      <<~DIRECTIVE.strip
        CANDIDATE CV EVIDENCE:
        #{highlights}
        DIRECTIVE: When probing "#{@query}", reference their real-world project experience above and ask about specific trade-offs and architectural decisions they made.
      DIRECTIVE
    end

    def empty_result
      Result.new(chunks: [], directive: nil, success?: false)
    end
  end
end
