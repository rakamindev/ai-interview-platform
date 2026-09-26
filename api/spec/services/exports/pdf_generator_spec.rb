# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let(:portfolio) { create(:portfolio, generation_status: 'complete') }

  # Everything the generator asks Prawn to write, in order.
  def drawn_text
    texts = []
    allow_any_instance_of(Prawn::Document).to receive(:text).and_wrap_original do |original, string, *args, **options|
      texts << string
      original.call(string, *args, **options)
    end
    described_class.new(portfolio: portfolio).call
    texts.join("\n")
  end

  it 'starts with what the report rests on' do
    create(:portfolio_skill, portfolio: portfolio, ai_level: 3)

    expect(drawn_text).to include('This report covers 1 of 1 skills.')
  end

  it 'gives an absent skill its reason and no level, even when an older row holds one' do
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Leadership', status: 'not_assessed', ai_level: 1,
                             competency_summary: 'An old guess.')

    text = drawn_text
    expect(text).to include('Not assessed. The interview did not reach this skill, so no level is given.')
    expect(text).not_to include('Level: L1')
    expect(text).not_to include('An old guess.')
  end

  it "still exports a skill a reviewer changed (the old arrow broke Prawn's built-in font)" do
    skill = create(:portfolio_skill, portfolio: portfolio, ai_level: 2)
    AssessorOverride.create!(portfolio_skill: skill, ai_level: 2, override_level: 4, overridden_by: 1)

    expect(drawn_text).to include('Level: L4 (the AI gave L2; a reviewer changed it to L4)')
  end

  it 'replaces characters the built-in font cannot draw, instead of failing the export' do
    create(:portfolio_skill, portfolio: portfolio, ai_level: 3, competency_summary: 'Ships fast 🚀 and explains why.')

    expect(drawn_text).to include('Ships fast ? and explains why.')
  end
end
