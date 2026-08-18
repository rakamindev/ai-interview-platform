module Api
  module V1
    class TenantResourceAccess
      def initialize(tenant_id)
        @tenant_id = tenant_id
      end

      def session(id)
        Session.joins(:assessment)
               .where(sessions: { tenant_id: @tenant_id }, assessments: { tenant_id: @tenant_id })
               .find(id)
      end

      def portfolio(id)
        Portfolio.joins(session: :assessment)
                 .where(sessions: { tenant_id: @tenant_id }, assessments: { tenant_id: @tenant_id })
                 .find(id)
      end

      def portfolio_skill(id)
        PortfolioSkill.joins(portfolio: { session: :assessment })
                      .where(sessions: { tenant_id: @tenant_id }, assessments: { tenant_id: @tenant_id })
                      .find(id)
      end

      def vacancy(id)
        Vacancy.where(tenant_id: @tenant_id).find(id)
      end
    end
  end
end
