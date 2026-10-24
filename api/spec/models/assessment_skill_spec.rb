# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessmentSkill, type: :model do
  it 'loads through the Rails test harness' do
    expect(described_class.table_name).to eq('assessment_skills')
  end
end
