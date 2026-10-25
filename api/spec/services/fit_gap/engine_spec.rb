require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:review) { create_review }
  let(:portfolio) { review.first }
  let(:vacancy) { review.last }

  def comparisons
    described_class.new(portfolio: portfolio, vacancy: vacancy).call.skill_comparisons
  end

  it 'compares the required level and effective human rating with provenance' do
    add_requirement(vacancy, level: 4)
    skill = add_rating(portfolio, level: 2)
    skill.create_assessor_override!(ai_level: 2, override_level: 4, overridden_by: 1, overridden_at: Time.current)
    expect(comparisons.first).to include('expected_level' => 4, 'candidate_level' => 4,
      'ai_level' => 2, 'rating_source' => 'assessor', 'result' => 'match', 'delta' => 0)
  end

  it 'keeps an unassessed requirement distinct from a demonstrated gap' do
    add_requirement(vacancy)
    expect(comparisons.first).to include('candidate_level' => nil, 'delta' => nil,
      'result' => 'not_assessed', 'rating_source' => 'none')
  end

  it 'does not match different canonical skill IDs just because labels coincide' do
    add_requirement(vacancy, skill_id: 'canonical-a')
    add_rating(portfolio, skill_id: 'canonical-b')
    expect(comparisons.first['result']).to eq('not_assessed')
  end

  it 'matches custom labels after trimming and case normalization' do
    add_requirement(vacancy, skill_id: nil, label: '  stakeholder   communication ')
    add_rating(portfolio, skill_id: nil, label: 'Stakeholder Communication', level: 4)
    expect(comparisons.first).to include('candidate_level' => 4, 'result' => 'exceed', 'delta' => 1)
  end

  it 'retains distinct requirements with the same label' do
    add_requirement(vacancy, skill_id: 'one')
    add_requirement(vacancy, skill_id: 'two')
    expect(comparisons.length).to eq(2)
  end

  it 'returns an explicit empty comparison for a vacancy without requirements' do
    expect(comparisons).to eq([])
  end

  it 'does not make any Gemini call or infer culture fit' do
    add_requirement(vacancy)
    expect(Gemini::HttpClient).not_to receive(:new)
    report = described_class.new(portfolio: portfolio, vacancy: vacancy).call
    expect(report.culture_narrative).to be_nil
    expect(report.overall_narrative).to include('not assessed')
  end

  it 'rejects comparisons across tenants, including calls outside a request' do
    add_requirement(vacancy)
    vacancy.update!(tenant_id: 202)
    expect { comparisons }.to raise_error(ActiveRecord::RecordNotFound)
  end

  (1..5).to_a.product((1..5).to_a).each do |observed, required|
    it "compares observed L#{observed} against required L#{required} without off-by-one errors" do
      add_requirement(vacancy, level: required)
      add_rating(portfolio, level: observed)
      expected = observed == required ? 'match' : observed > required ? 'exceed' : 'gap'
      expect(comparisons.first).to include('result' => expected, 'delta' => observed - required)
    end
  end

  it 'treats an ambiguous duplicate rating as unassessed' do
    add_requirement(vacancy)
    2.times { add_rating(portfolio) }
    expect(comparisons.first['result']).to eq('not_assessed')
  end

  it 'normalizes canonical ID case without matching unrelated IDs' do
    add_requirement(vacancy, skill_id: 'SK-ENG-004')
    add_rating(portfolio, skill_id: 'sk-eng-004')
    expect(comparisons.first['result']).to eq('match')
  end
end
