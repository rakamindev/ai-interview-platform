# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CreateAssessorOverrideEvents do
  let(:migration) { described_class.new }

  before do
    allow(migration).to receive(:say_with_time).and_yield
  end

  describe '#up' do
    it 'runs without error' do
      expect { migration.up }.not_to raise_error
    end

    it 'creates the assessor_override_events table' do
      migration.up

      expect(connection.table_exists?(:assessor_override_events)).to be true
    end

    it 'backfills one event per existing override' do
      migration.up

      # Create test data with tenant_id
      org = create(:organization)
      session = create(:session, tenant_id: org.id)
      portfolio = create(:portfolio, session: session, tenant_id: org.id)
      portfolio_skill = create(:portfolio_skill, portfolio: portfolio, tenant_id: org.id)
      override = create(:assessor_override, portfolio_skill: portfolio_skill, tenant_id: org.id)

      # Run backfill again (idempotent — only inserts where no event exists)
      migration.send(:backfill_events)

      event = AssessorOverrideEvent.find_by(portfolio_skill_id: portfolio_skill.id)
      expect(event).to be_present
      expect(event.ai_level).to eq(override.ai_level)
      expect(event.override_level).to eq(override.override_level)
      expect(event.tenant_id).to eq(org.id)
    end

    it 'creates append-only triggers' do
      migration.up

      # Verify triggers exist
      triggers = connection.execute(<<~SQL.squish).map { |r| r['trigger_name'] }
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE event_object_table = 'assessor_override_events'
          AND trigger_schema = 'ai_interview'
      SQL

      expect(triggers).to include('trg_no_override_event_update')
      expect(triggers).to include('trg_no_override_event_delete')
    end
  end

  describe '#down' do
    it 'drops the assessor_override_events table' do
      migration.up
      migration.down

      expect(connection.table_exists?(:assessor_override_events)).to be false
    end
  end

  private

  def connection
    ActiveRecord::Base.connection
  end
end
