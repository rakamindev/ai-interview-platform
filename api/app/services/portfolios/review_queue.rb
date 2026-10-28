# frozen_string_literal: true

module Portfolios
  # The tenant's portfolios that still need a human, oldest first (never by a
  # score). Reasons come from ReviewReasons; this class only selects, counts,
  # filters and pages. Reasons are computed in Ruby over the tenant's finished
  # portfolios with one preload, which is fine at the current scale; a stored
  # flag would be the next step for very large tenants.
  class ReviewQueue
    PER_PAGE = 50

    class UnknownGroup < StandardError; end

    def initialize(tenant_id:, group: nil, page: 1)
      raise UnknownGroup if group.present? && !ReviewReasons::GROUPS.key?(group)

      @tenant_id = tenant_id
      @group     = group.presence
      @page      = [page.to_i, 1].max
    end

    def call
      paged = Kaminari.paginate_array(filtered).page(@page).per(PER_PAGE)
      {
        summary: summary,
        items: paged.map { |entry| item(entry) },
        meta: { current_page: paged.current_page, total_pages: paged.total_pages,
                total_count: paged.total_count, per_page: PER_PAGE }
      }
    end

    private

    def entries
      @entries ||= Portfolio.for_tenant(@tenant_id)
                            .where(generation_status: %w[complete failed])
                            .includes(*ReviewReasons::PRELOAD)
                            .map { |portfolio| [portfolio, ReviewReasons.new(portfolio)] }
                            .select { |_, reasons| reasons.needs_review? }
                            .sort_by { |portfolio, reasons| [reasons.waiting_since, portfolio.id] }
    end

    def filtered
      return entries unless @group

      codes = ReviewReasons::GROUPS.fetch(@group)
      entries.select { |_, reasons| reasons.reasons.any? { |r| codes.include?(r[:code]) } }
    end

    def summary
      totals = ReviewReasons::CODES.index_with { 0 }
      entries.each { |_, reasons| reasons.reasons.each { |r| totals[r[:code]] += r[:count] } }
      totals.merge('portfolios' => entries.size)
    end

    def item(entry)
      portfolio, reasons = entry
      session = portfolio.session
      {
        portfolio_id: portfolio.id,
        session_id: session.id,
        assessment_id: session.assessment_id,
        assessment_name: session.assessment.name,
        candidate_name: session.candidate_name,
        reasons: reasons.reasons,
        waiting_since: reasons.waiting_since,
        target: reasons.target
      }
    end
  end
end
