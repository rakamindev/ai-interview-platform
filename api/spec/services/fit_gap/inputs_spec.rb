# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Inputs do
  let(:scenario) { build_fit_gap_scenario }
  let(:portfolio) { scenario[:portfolio] }
  let(:vacancy) { scenario[:vacancy] }

  def digest = described_class.new(portfolio: portfolio.reload, vacancy: vacancy.reload).digest

  it 'is stable when nothing changes' do
    expect(digest).to eq(digest)
  end

  it 'changes when an assessor overrides a rating' do
    expect { create(:assessor_override, portfolio_skill: scenario[:skills][:communication], override_level: 3) }
      .to(change { digest })
  end

  it 'changes when the override notes change' do
    override = create(:assessor_override, portfolio_skill: scenario[:skills][:communication], override_level: 3)
    expect { override.update!(assessor_notes: 'Revised after reference call') }.to(change { digest })
  end

  it 'changes when the vacancy expectations change' do
    expect { vacancy.vacancy_skills.first.update!(expected_level: 4) }.to(change { digest })
  end

  it 'changes when the portfolio is regenerated' do
    expect { portfolio.update!(generated_at: 1.minute.from_now) }.to(change { digest })
  end

  it 'exposes override levels on ratings' do
    create(:assessor_override, portfolio_skill: scenario[:skills][:communication], override_level: 4,
                               assessor_notes: 'Seen in work sample')
    rating = described_class.new(portfolio:, vacancy:).ratings.find { |r| r.skill_label == 'Communication' }

    expect(rating.to_h).to include(ai_level: 2, override_level: 4, assessor_notes: 'Seen in work sample')
  end
end
