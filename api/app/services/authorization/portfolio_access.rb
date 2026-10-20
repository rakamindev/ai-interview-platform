# frozen_string_literal: true

module Authorization
  class PortfolioAccess
    class << self
      def find_portfolio!(portfolio_id, tenant_id:)
        Portfolio
          .joins(session: :assessment)
          .where(sessions: { tenant_id: }, assessments: { tenant_id: })
          .find(portfolio_id)
      end

      def find_for_session!(session_id, tenant_id:)
        Portfolio
          .joins(session: :assessment)
          .where(
            session_id:,
            sessions: { tenant_id: },
            assessments: { tenant_id: }
          )
          .first!
      end

      def find_portfolio_skill!(portfolio_skill_id, tenant_id:)
        PortfolioSkill
          .joins(portfolio: { session: :assessment })
          .where(
            sessions: { tenant_id: },
            assessments: { tenant_id: }
          )
          .find(portfolio_skill_id)
      end

      def find_vacancy!(vacancy_id, tenant_id:)
        Vacancy.unscoped.where(tenant_id:).find(vacancy_id)
      end

      def find_report(portfolio_id:, vacancy_id:, tenant_id:)
        FitGapReport
          .joins({ portfolio: { session: :assessment } }, :vacancy)
          .where(
            fit_gap_reports: { portfolio_id:, vacancy_id: },
            sessions: { tenant_id: },
            assessments: { tenant_id: },
            vacancies: { tenant_id: }
          )
          .first
      end

      def find_fit_gap_inputs_for_worker!(portfolio_id, vacancy_id)
        portfolio = Portfolio.joins(session: :assessment).find(portfolio_id)
        vacancy = Vacancy.unscoped.find(vacancy_id)

        unless portfolio.session.tenant_id == vacancy.tenant_id &&
               portfolio.session.assessment.tenant_id == vacancy.tenant_id
          raise ActiveRecord::RecordNotFound
        end

        [portfolio, vacancy]
      end

      def find_session_for_websocket!(session_id, tenant_id:)
        Session
          .joins(:assessment)
          .where(sessions: { tenant_id: }, assessments: { tenant_id: })
          .find(session_id)
      end
    end
  end
end
