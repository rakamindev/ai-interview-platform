# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  subject(:session) { build(:session) }

  it 'is valid with valid attributes' do
    expect(session).to be_valid
  end

  it 'generates invite_token on create' do
    s = create(:session)
    expect(s.invite_token).to be_present
  end

  it 'validates status inclusion' do
    session.status = 'invalid_status'
    expect(session).not_to be_valid
  end

  it 'provides status predicate methods' do
    session.status = 'active'
    expect(session.active?).to be true
    expect(session.ended?).to be false
  end
end

RSpec.describe Assessment, type: :model do
  subject(:assessment) { build(:assessment) }

  it 'is valid with valid attributes' do
    expect(assessment).to be_valid
  end

  it 'validates name presence' do
    assessment.name = nil
    expect(assessment).not_to be_valid
  end

  it 'validates time_limit_min inclusion' do
    assessment.time_limit_min = 25
    expect(assessment).not_to be_valid
  end
end

RSpec.describe Portfolio, type: :model do
  subject(:portfolio) { build(:portfolio) }

  it 'is valid with valid attributes' do
    expect(portfolio).to be_valid
  end

  it 'validates generation_status inclusion' do
    portfolio.generation_status = 'invalid'
    expect(portfolio).not_to be_valid
  end
end

RSpec.describe PortfolioSkill, type: :model do
  subject(:skill) { build(:portfolio_skill) }

  it 'is valid with valid attributes' do
    expect(skill).to be_valid
  end

  it 'validates ai_level range' do
    skill.ai_level = 6
    expect(skill).not_to be_valid
  end
end

RSpec.describe CoverageMap, type: :model do
  subject(:coverage_map) { build(:coverage_map) }

  it 'is valid with valid attributes' do
    expect(coverage_map).to be_valid
  end

  it 'validates state inclusion' do
    coverage_map.state = 'invalid'
    expect(coverage_map).not_to be_valid
  end
end

RSpec.describe Vacancy, type: :model do
  subject(:vacancy) { build(:vacancy) }

  it 'is valid with valid attributes' do
    expect(vacancy).to be_valid
  end

  it 'validates role_title presence' do
    vacancy.role_title = nil
    expect(vacancy).not_to be_valid
  end
end

RSpec.describe VacancySkill, type: :model do
  subject(:skill) { build(:vacancy_skill) }

  it 'is valid with valid attributes' do
    expect(skill).to be_valid
  end

  it 'validates expected_level range' do
    skill.expected_level = 0
    expect(skill).not_to be_valid
  end
end

RSpec.describe User, type: :model do
  subject(:user) { build(:user) }

  it 'is valid with valid attributes' do
    expect(user).to be_valid
  end

  it 'authenticates password correctly' do
    user.save!
    expect(user.authenticate('password123')).to eq(user)
    expect(user.authenticate('wrong')).to be false
  end
end
