# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:gemini_client) do
    instance_double(
      Gemini::HttpClient,
      generate_content: {
        'culture_narrative' => 'Good fit.',
        'overall_narrative' => 'Recommend proceeding.'
      }
    )
  end

  def build_portfolio
    session = create(:session)
    Portfolio.create!(session_id: session.id)
  end

  def build_vacancy_with_a_skill
    vacancy = create(:vacancy)
    create(:vacancy_skill, vacancy: vacancy)
    # vacancy.vacancy_skills was cached (as empty) by the after_save callback's own
    # `.reload` when `vacancy` was created, before the skill existed — reload the
    # parent so FitGap::Engine#build_skill_comparisons (which reads it live) sees it.
    vacancy.reload
  end

  def generate(portfolio, vacancy)
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client).call
  end

  it "stamps the vacancy's current version when generating a report" do
    vacancy = build_vacancy_with_a_skill
    portfolio = build_portfolio

    report = generate(portfolio, vacancy)

    expect(report.vacancy_version_id).to eq(vacancy.vacancy_versions.order(created_at: :desc).first.id)
  end

  it 'keeps referencing the version at generation time after a later vacancy edit, until regenerated' do
    vacancy = build_vacancy_with_a_skill
    portfolio = build_portfolio

    report = generate(portfolio, vacancy)
    original_version_id = report.vacancy_version_id

    vacancy.update!(role_title: 'Updated Role Title')

    expect(report.reload.vacancy_version_id).to eq(original_version_id)
  end

  it 'restamps the report to the newest version on regeneration, updating the same row' do
    vacancy = build_vacancy_with_a_skill
    portfolio = build_portfolio

    first_report = generate(portfolio, vacancy)
    original_version_id = first_report.vacancy_version_id

    vacancy.update!(role_title: 'Updated Role Title')
    newest_version_id = vacancy.vacancy_versions.order(created_at: :desc).first.id
    expect(newest_version_id).not_to eq(original_version_id)

    regenerated_report = generate(portfolio, vacancy)

    expect(regenerated_report.id).to eq(first_report.id)
    expect(regenerated_report.vacancy_version_id).to eq(newest_version_id)
  end
end
