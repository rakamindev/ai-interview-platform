# frozen_string_literal: true

require "rails_helper"

RSpec.describe PortfolioSkillGenerationEvent do
  let(:portfolio) { create(:portfolio) }
  let(:skill) { create(:portfolio_skill, portfolio: portfolio, tenant_id: portfolio.tenant_id) }

  before do
    RequestStore.store[:tenant_id] = portfolio.tenant_id
  end

  after do
    RequestStore.clear!
  end

  describe "valid creation" do
    it "creates event with valid attributes" do
      event = described_class.create!(
        portfolio_skill_id: skill.id,
        tenant_id: skill.tenant_id,
        event_type: "stale_marked",
        reason: "AI no longer returns this skill label"
      )

      expect(event).to be_persisted
      expect(event.event_type).to eq("stale_marked")
      expect(event.reason).to eq("AI no longer returns this skill label")
      expect(event.tenant_id).to eq(skill.tenant_id)
    end

    it "fills tenant_id from skill when not provided" do
      event = described_class.create!(
        portfolio_skill_id: skill.id,
        event_type: "restored",
        reason: "AI returned this skill again"
      )

      expect(event.tenant_id).to eq(skill.tenant_id)
    end
  end

  describe "validations" do
    it "rejects invalid event_type" do
      event = described_class.new(
        portfolio_skill_id: skill.id,
        tenant_id: skill.tenant_id,
        event_type: "invalid",
        reason: "test"
      )

      expect(event).not_to be_valid
      expect(event.errors[:event_type]).to be_present
    end

    it "requires reason" do
      event = described_class.new(
        portfolio_skill_id: skill.id,
        tenant_id: skill.tenant_id,
        event_type: "stale_marked"
      )

      expect(event).not_to be_valid
      expect(event.errors[:reason]).to be_present
    end
  end

  describe "append-only enforcement" do
    it "prevents UPDATE via Postgres trigger" do
      event = described_class.create!(
        portfolio_skill_id: skill.id,
        tenant_id: skill.tenant_id,
        event_type: "stale_marked",
        reason: "original reason"
      )

      expect do
        described_class.connection.execute(<<~SQL.squish)
          UPDATE ai_interview.portfolio_skill_generation_events
          SET reason = 'hacked'
          WHERE id = #{event.id}
        SQL
      end.to raise_error(ActiveRecord::StatementInvalid, /append-only/)
    end

    it "prevents DELETE via Postgres trigger" do
      event = described_class.create!(
        portfolio_skill_id: skill.id,
        tenant_id: skill.tenant_id,
        event_type: "stale_marked",
        reason: "to be deleted"
      )

      expect do
        described_class.connection.execute(<<~SQL.squish)
          DELETE FROM ai_interview.portfolio_skill_generation_events
          WHERE id = #{event.id}
        SQL
      end.to raise_error(ActiveRecord::StatementInvalid, /append-only/)
    end
  end
end
