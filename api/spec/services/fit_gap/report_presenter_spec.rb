# frozen_string_literal: true

require 'spec_helper'
require_relative '../../../app/services/fit_gap/report_presenter'

RSpec.describe FitGap::ReportPresenter do
  it 'copies expected_level into required_level for reports written before the contract fix' do
    rows = described_class.comparisons([{ 'skill_label' => 'SQL', 'expected_level' => 3, 'result' => 'gap' }])

    expect(rows.first['required_level']).to eq(3)
    expect(rows.first['expected_level']).to eq(3)
  end

  it 'keeps an explicit required level' do
    rows = described_class.comparisons([{ required_level: 2, expected_level: 4 }])

    expect(rows.first['required_level']).to eq(2)
    expect(rows.first['expected_level']).to eq(4)
  end
end
