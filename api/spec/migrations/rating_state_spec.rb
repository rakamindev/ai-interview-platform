# frozen_string_literal: true

require "rails_helper"
require Rails.root.join("db/migrate/20260819000004_add_rating_state_to_portfolio_skills")

RSpec.describe AddRatingStateToPortfolioSkills do
  let(:migration) { described_class.new }

  before do
    allow(migration).to receive(:say_with_time).and_yield
  end

  # db:prepare loads the final schema.rb directly rather than running
  # migrations one by one, so this migration is already applied before any
  # example runs — `migration.up` would immediately hit "already exists".
  # Roll it back first, run the example, then roll the whole thing back
  # (Postgres DDL is transactional) so the suite's baseline schema is
  # untouched afterward regardless of pass/fail.
  around do |example|
    ActiveRecord::Base.connection.transaction do
      migration.down
      example.run
      raise ActiveRecord::Rollback
    end
  end

  describe "#up" do
    it "runs without error" do
      expect { migration.up }.not_to raise_error
    end

    it "adds rating_state column with default rated" do
      migration.up

      expect(connection.column_exists?(:portfolio_skills, :rating_state)).to be true
      col = connection.columns(:portfolio_skills).find { |c| c.name == "rating_state" }
      expect(col.default).to eq("rated")
      expect(col.null).to be false
    end

    it "allows ai_level to be NULL" do
      migration.up

      col = connection.columns(:portfolio_skills).find { |c| c.name == "ai_level" }
      expect(col.null).to be true
    end

    it "CHECK constraint allows NULL ai_level" do
      migration.up

      # NULL should not violate the CHECK constraint
      org = create(:organization)
      session = create(:session, tenant_id: org.id)
      portfolio = create(:portfolio, session: session, tenant_id: org.id)

      expect do
        connection.execute(<<~SQL.squish)
          INSERT INTO ai_interview.portfolio_skills
            (portfolio_id, skill_label, ai_level, ai_confidence, competency_summary,
             is_discovered, rating_state, tenant_id)
          VALUES (#{portfolio.id}, 'Test Skill', NULL, 'low', 'Summary', false, 'unrated', #{org.id})
        SQL
      end.not_to raise_error
    end
  end

  describe "#down" do
    it "deletes unrated rows and restores constraints" do
      migration.up
      migration.down

      expect(connection.column_exists?(:portfolio_skills, :rating_state)).to be false
      col = connection.columns(:portfolio_skills).find { |c| c.name == "ai_level" }
      expect(col.null).to be false
    end
  end

  private

  def connection
    ActiveRecord::Base.connection
  end
end
