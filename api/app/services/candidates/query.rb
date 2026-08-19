# frozen_string_literal: true

module Candidates
  # Builds the filtered/sorted candidate relation for an assessment's
  # candidate-management view. Returns Result#relation (nil on invalid
  # input) plus Result#errors so the controller can reject bad filter
  # values instead of silently accepting anything.
  class Query
    INTERVIEW_STATUSES = %w[completed pending failed].freeze
    SORT_FIELDS = %w[name interview_date interview_status verdict].freeze
    DIRECTIONS = %w[asc desc].freeze

    SORT_COLUMNS = {
      'name'             => 'sessions.candidate_name',
      'interview_date'   => 'sessions.started_at',
      'interview_status' => 'sessions.status',
      'verdict'          => 'portfolios.verdict'
    }.freeze

    Result = Struct.new(:relation, :errors) do
      def valid? = errors.empty?
    end

    def self.call(...) = new(...).call

    def initialize(assessment:, search: nil, interview_status: nil, verdict: nil, sort: nil, direction: nil)
      @assessment = assessment
      @search = search.to_s.strip
      @interview_status = interview_status.presence
      @verdict = verdict.presence
      @sort = sort.presence || 'interview_date'
      @direction = DIRECTIONS.include?(direction.to_s) ? direction.to_s : 'desc'
      @errors = []
    end

    def call
      validate!
      return Result.new(nil, @errors) if @errors.any?

      scope = @assessment.sessions.left_joins(:portfolio)
      scope = apply_search(scope)
      scope = apply_interview_status(scope)
      scope = apply_verdict(scope)
      scope = apply_sort(scope)

      Result.new(scope, @errors)
    end

    private

    def validate!
      @errors << "invalid interview_status: #{@interview_status}" if @interview_status && !INTERVIEW_STATUSES.include?(@interview_status)
      @errors << "invalid verdict: #{@verdict}" if @verdict && !Portfolio::VERDICTS.include?(@verdict)
      @errors << "invalid sort: #{@sort}" unless SORT_FIELDS.include?(@sort)
    end

    def apply_search(scope)
      return scope if @search.blank?

      scope.where("sessions.candidate_name ILIKE ?", "%#{@search}%")
    end

    def apply_interview_status(scope)
      return scope unless @interview_status

      # "completed" is the candidate-facing label for a session that ended.
      value = @interview_status == 'completed' ? 'ended' : @interview_status
      scope.where(sessions: { status: value })
    end

    def apply_verdict(scope)
      return scope unless @verdict

      scope.where(portfolios: { verdict: @verdict })
    end

    def apply_sort(scope)
      column = SORT_COLUMNS.fetch(@sort)
      # NULLS LAST so candidates missing the sorted attribute (no verdict yet,
      # never started) sink to the bottom instead of leading either direction.
      # A stable secondary key (session id) keeps ties deterministic.
      scope.order(Arel.sql("#{column} #{@direction.upcase} NULLS LAST")).order(:id)
    end
  end
end
