# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CvScreenings::DecisionEngine do
  let(:vacancy) { create(:vacancy, public_requirement_text: 'Must know Ruby.') }
  let(:assessment) { create(:assessment) }
  let(:screening) { create(:cv_screening, vacancy: vacancy, assessment: assessment, threshold: 70) }
  let(:batch) { create(:cv_screening_batch, cv_screening: screening) }
  let(:entry) { create(:cv_screening_entry, cv_screening_batch: batch) }

  def stub_extraction(status:, text: nil, reason: nil, char_count: 100)
    result = CvScreenings::TextExtractor::Result.new(status: status, reason: reason, text: text, char_count: char_count)
    allow(CvScreenings::TextExtractor).to receive(:new).and_return(instance_double(CvScreenings::TextExtractor, call: result))
  end

  def gemini_returning(*responses)
    dbl = instance_double(Gemini::HttpClient)
    allow(dbl).to receive(:generate_content).and_return(*responses)
    dbl
  end

  it 'lands in needs_review with parse_failed when extraction fails' do
    stub_extraction(status: :parse_failed, reason: :corrupt)

    described_class.new(entry: entry).call

    expect(entry.reload.decision).to eq('needs_review')
    expect(entry.decision_reason).to eq('parse_failed')
  end

  it 'lands in needs_review with empty_text when the CV has no text layer' do
    stub_extraction(status: :empty_text, reason: :no_text_layer)

    described_class.new(entry: entry).call

    expect(entry.reload.decision).to eq('needs_review')
    expect(entry.decision_reason).to eq('empty_text')
  end

  it 'lands in needs_review with no_email_detected when no email is found' do
    stub_extraction(status: :ok, text: 'No contact info here at all.')

    described_class.new(entry: entry).call

    expect(entry.reload.decision).to eq('needs_review')
    expect(entry.decision_reason).to eq('no_email_detected')
  end

  it 'lands in not_advanced with failed_public_gate when Layer 1 rejects, and generates feedback' do
    stub_extraction(status: :ok, text: "jordan.example@test.invalid\nFabricated CV.")
    gemini_client = gemini_returning(
      { 'passes' => false, 'reasoning' => 'no fit' },
      { 'feedback' => 'Thanks for applying.' }
    )

    described_class.new(entry: entry, gemini_client: gemini_client).call

    expect(entry.reload.decision).to eq('not_advanced')
    expect(entry.decision_reason).to eq('failed_public_gate')
    expect(entry.feedback_text).to eq('Thanks for applying.')
  end

  it 'lands in needs_review with model_failed when Layer 1 itself errors — never a rejection' do
    stub_extraction(status: :ok, text: "jordan.example@test.invalid\nFabricated CV.")
    gemini_client = gemini_returning({ 'unexpected' => 'shape' })

    described_class.new(entry: entry, gemini_client: gemini_client).call

    expect(entry.reload.decision).to eq('needs_review')
    expect(entry.decision_reason).to eq('model_failed')
  end

  it 'lands in needs_review with model_failed when Layer 2 itself errors, after Layer 1 passed' do
    stub_extraction(status: :ok, text: "jordan.example@test.invalid\nFabricated CV.")
    gemini_client = gemini_returning({ 'passes' => true }, { 'score' => 'not a number' })

    described_class.new(entry: entry, gemini_client: gemini_client).call

    expect(entry.reload.decision).to eq('needs_review')
    expect(entry.decision_reason).to eq('model_failed')
  end

  it 'auto-invites and creates a session when the score is above the threshold' do
    stub_extraction(status: :ok, text: "jordan.example@test.invalid\nFabricated CV.")
    gemini_client = gemini_returning({ 'passes' => true }, { 'score' => 85, 'reasoning' => 'Strong fit.' })

    expect { described_class.new(entry: entry, gemini_client: gemini_client).call }
      .to change(Session, :count).by(1)

    expect(entry.reload.decision).to eq('invited')
    expect(entry.decision_reason).to eq('auto_invited')
  end

  it 'auto-invites when the score is EXACTLY equal to the threshold — the >= boundary, ' \
     'the exact line the Phase 9 seeded fault targets' do
    stub_extraction(status: :ok, text: "jordan.example@test.invalid\nFabricated CV.")
    gemini_client = gemini_returning({ 'passes' => true },
                                      { 'score' => screening.threshold, 'reasoning' => 'Exactly meets the bar.' })

    described_class.new(entry: entry, gemini_client: gemini_client).call

    expect(entry.reload.decision).to eq('invited')
    expect(entry.decision_reason).to eq('auto_invited')
  end

  it 'lands in needs_review with below_private_threshold when the score is under the threshold — never auto-rejects' do
    stub_extraction(status: :ok, text: "jordan.example@test.invalid\nFabricated CV.")
    gemini_client = gemini_returning({ 'passes' => true },
                                      { 'score' => screening.threshold - 1, 'reasoning' => 'Close but not quite.' })

    described_class.new(entry: entry, gemini_client: gemini_client).call

    expect(entry.reload.decision).to eq('needs_review')
    expect(entry.decision_reason).to eq('below_private_threshold')
  end

  it 'never auto-decides when the batch has no threshold configured, even with a strong score' do
    no_threshold_screening = create(:cv_screening, vacancy: vacancy, assessment: assessment, threshold: nil)
    no_threshold_batch = create(:cv_screening_batch, cv_screening: no_threshold_screening, threshold: nil)
    no_threshold_entry = create(:cv_screening_entry, cv_screening_batch: no_threshold_batch)

    stub_extraction(status: :ok, text: "jordan.example@test.invalid\nFabricated CV.")
    gemini_client = gemini_returning({ 'passes' => true }, { 'score' => 99, 'reasoning' => 'Excellent fit.' })

    described_class.new(entry: no_threshold_entry, gemini_client: gemini_client).call

    expect(no_threshold_entry.reload.decision).to eq('needs_review')
    expect(no_threshold_entry.decision_reason).to eq('below_private_threshold')
  end
end
