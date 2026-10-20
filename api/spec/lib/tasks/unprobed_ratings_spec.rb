# frozen_string_literal: true

require 'rails_helper'
require 'rake'

# Step 4, "Existing data": past ratings are not rewritten, but the team can see how many
# L1s were stored for skills the interview never probed, and decide what to do.
RSpec.describe 'portfolios:unprobed_ratings' do
  before(:all) do
    Rails.application.load_tasks if Rake::Task.tasks.none? { _1.name == 'portfolios:unprobed_ratings' }
  end

  let(:task)      { Rake::Task['portfolios:unprobed_ratings'] }
  let(:session)   { create(:session, :ended) }
  let(:portfolio) { create(:portfolio, session:) }

  before do
    create(:coverage_map, session:, skill_label: 'Communication', state: 'not_yet', probe_count: 0)
    create(:coverage_map, session:, skill_label: 'React', state: 'covered', probe_count: 3)
    create(:portfolio_skill, portfolio:, skill_label: 'Communication', ai_level: 1)
    create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 1)
  end

  it 'counts L1 ratings for skills that were never probed, and changes nothing' do
    before = PortfolioSkill.order(:id).pluck(:ai_level)
    task.reenable

    expect { task.invoke }.to output(/1 L1 rating for a skill the interview never probed/).to_stdout
    expect(PortfolioSkill.order(:id).pluck(:ai_level)).to eq(before)
  end
end
