# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db/migrate/20261106100001_backfill_portfolio_generations.rb')

RSpec.describe 'Portfolio generation backfill collisions', type: :request do
  let(:org)        { create_org }
  let(:assessment) { create_assessment(org: org) }
  let(:session)    { create_interviewed_session(org: org, assessment: assessment) }

  it 'keeps legacy keys unique and repeats down/up without losing the first configured identity' do
    session.update!(status: 'ended')
    portfolio = session.create_portfolio!(generation_status: 'complete', generated_at: Time.current)
    configured = assessment.assessment_skills.first
    rows = [
      ['C++', true], ['C#', true],
      [configured.skill_label, false], [configured.skill_label, false],
      ['!!!', true], ['???', true]
    ].map do |label, discovered|
      PortfolioSkill.create!(portfolio: portfolio, generation_id: nil, skill_key: nil,
                             skill_label: label, is_discovered: discovered, ai_level: 3,
                             ai_confidence: 'low', evidence: [], competency_summary: 'Synthetic legacy row')
    end
    migration = BackfillPortfolioGenerations.new

    ActiveRecord::Migration.suppress_messages { migration.up }
    generation_id = portfolio.reload.current_generation_id
    keys = rows.map { |row| row.reload.skill_key }
    expect(rows.map(&:generation_id).uniq).to eq([generation_id])
    expect(keys.uniq.length).to eq(rows.length)
    expect(rows[2].skill_key).to eq("assessment_skill:#{configured.id}")
    expect(rows[3].skill_key).to start_with('label:')
    expect(rows[0].skill_key).to eq('discovered:c')
    expect(rows[1].skill_key).to eq("discovered:c:#{rows[1].id}")
    expect(rows[4].skill_key).to eq('discovered:')
    expect(rows[5].skill_key).to eq("discovered::#{rows[5].id}")

    ActiveRecord::Migration.suppress_messages { migration.down }
    expect(portfolio.reload.current_generation_id).to be_nil
    expect(rows.map { |row| row.reload.generation_id }).to all(be_nil)
    expect(rows.map(&:skill_key)).to all(be_nil)
    ActiveRecord::Migration.suppress_messages { migration.up }
    expect(rows.map { |row| row.reload.skill_key }).to eq(keys)
    expect(rows.map(&:generation_id).uniq).to eq([portfolio.reload.current_generation_id])
  end
end
