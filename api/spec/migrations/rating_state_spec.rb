# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AddRatingStateToPortfolioSkills do
  let(:migration) { described_class.new }

  before do
    allow(migration).to receive(:say_with_time).and_yield
  end

  describe '#up' do
    it 'runs without error' do
      expect { migration.up }.not_to raise_error
    end

    it 'adds rating_state column with default rated' do
      migration.up

      expect(connection.column_exists?(:portfolio_skills, :rating_state)).to be true
      col = connection.columns(:portfolio_skills).find { |c| c.name == 'rating_state' }
      expect(col.default).to eq('rated')
      expect(col.null).to be false
    end

    it 'allows ai_level to be NULL' do
      migration.up

      col = connection.columns(:portfolio_skills).find { |c| c.name == 'ai_level' }
      expect(col.null).to be true
    end

    it 'CHECK constraint allows NULL ai_level' do
      migration.up

      # NULL should not violate the CHECK constraint
      org = create(:organization)
      session = create(:session, tenant_id: org.id)
      portfolio = create(:portfolio, session: session, tenant_id: org.id)

      expect {
        connection.execute(<<~SQL.squish)
          INSERT INTO ai_interview.portfolio_skills
            (portfolio_id, skill_label, ai_level, ai_confidence, competency_summary,
             is_discovered, rating_state, tenant_id, created_at)
          VALUES (#{portfolio.id}, 'Test Skill', NULL, 'low', 'Summary', false, 'unrated', #{org.id}, NOW())
        SQL
      }.not_to raise_error
    end
  end

  describe '#down' do
    it 'deletes unrated rows and restores constraints' do
      migration.up
      migration.down

      expect(connection.column_exists?(:portfolio_skills, :rating_state)).to be false
      col = connection.columns(:portfolio_skills).find { |c| c.name == 'ai_level' }
      expect(col.null).to be false
    end
  end

  private

  def connection
    ActiveRecord::Base.connection
  end
end
