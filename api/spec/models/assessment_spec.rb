# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, type: :model do
  describe 'cascade deletion' do
    it 'safely deletes assessment and cascades destruction to child sessions and reports' do
      assessment = Assessment.create!(
        name: 'Fullstack Assessment',
        time_limit_min: 30,
        tenant_id: Current.tenant_id,
        created_by: 1
      )

      session = Session.create!(
        assessment: assessment,
        candidate_name: 'Test Candidate',
        tenant_id: Current.tenant_id,
        status: 'pending'
      )

      portfolio = Portfolio.create!(
        session: session,
        generation_status: 'complete'
      )

      session_id = session.id
      portfolio_id = portfolio.id

      expect { assessment.destroy }.not_to raise_error
      expect(assessment.destroyed?).to be true
      expect(Session.find_by(id: session_id)).to be_nil
      expect(Portfolio.find_by(id: portfolio_id)).to be_nil
    end
  end
end
