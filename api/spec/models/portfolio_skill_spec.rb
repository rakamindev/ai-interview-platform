require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  it 'rejects an AI level outside 1 to 5' do
    skill = PortfolioSkill.new(ai_level: 6)

    expect(skill).not_to be_valid
    expect(skill.errors[:ai_level]).to be_present
  end
end
