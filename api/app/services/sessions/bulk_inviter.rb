# frozen_string_literal: true

module Sessions
  class BulkInviter
    Candidate = Struct.new(:identifier, :name, keyword_init: true)
    Result    = Struct.new(:identifier, :success, :session, :error, keyword_init: true)

    def initialize(assessment:, candidates:, tenant_id:)
      @assessment = assessment
      @candidates = candidates
      @tenant_id  = tenant_id
    end

    # Returns Array<Result>
    def call
      @candidates.map do |candidate_data|
        invite(candidate_data)
      end
    end

    private

    def invite(candidate_data)
      identifier = candidate_data[:candidate_id] || candidate_data[:email] || candidate_data[:identifier]
      name       = candidate_data[:candidate_name] || candidate_data[:name]

      session = @assessment.sessions.new(
        candidate_id: identifier,
        candidate_name: name.presence,
        tenant_id: @tenant_id
      )

      if session.save
        Result.new(
          identifier: identifier,
          success: true,
          session: session,
          error: nil
        )
      else
        Result.new(
          identifier: identifier,
          success: false,
          session: nil,
          error: session.errors.full_messages.first
        )
      end
    rescue StandardError => e
      Result.new(
        identifier: identifier,
        success: false,
        session: nil,
        error: e.message
      )
    end
  end
end
