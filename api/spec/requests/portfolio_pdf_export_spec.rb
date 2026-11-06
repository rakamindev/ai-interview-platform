# frozen_string_literal: true

require 'rails_helper'

# W20: PDF export returned 500 when AI text contained characters outside Windows-1252 (Prawn's
# built-in fonts), which real model output does ("→", "≥", "✓"). The export is the last step of the
# assessor's journey: the document that goes into the hiring conversation.
RSpec.describe 'Portfolio PDF export (W20)', type: :request do
  let(:org) { create_org }
  let(:session) { create_interviewed_session(org: org, assessment: create_assessment(org: org)) }
  let(:quote) { 'I moved the feed into a store so components subscribe to just the slice they need.' }
  let(:portfolio) do
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    stub_gemini(model_output(level: 3, quote: quote))
    run_job(PortfolioGeneratorWorker, last_enqueued_args(PortfolioGeneratorWorker))
    session.reload.portfolio
  end

  it 'exports a PDF when the AI text contains characters outside Windows-1252' do
    portfolio.portfolio_skills.first.update!(competency_summary: 'Trade-offs → store; latency ≥ 200 ms ✓ — “quoted”')
    get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'pdf' }, headers: auth_headers(org)

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq('application/pdf')
    expect(response.body).to start_with('%PDF')
  end

  {
    'transcript_match' => 'Found in transcript (turns 4)',
    'no_exact_match' => 'AI-proposed excerpt - no exact transcript match; check source',
    'not_found' => 'No supporting transcript excerpt found',
    nil => 'Excerpt not checked against the transcript; check source'
  }.each do |status, label|
    it "preserves quote provenance in the PDF for #{status || 'legacy unchecked evidence'}" do
      skill = portfolio.portfolio_skills.first
      checks = status ? [{ 'quote' => quote, 'status' => status, 'turn_numbers' => [4] }] : []
      skill.update!(evidence_checks: checks)
      rendered_text = []
      allow_any_instance_of(Prawn::Document).to receive(:text).and_wrap_original do |original, text, **options|
        rendered_text << text
        original.call(text, **options)
      end

      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'pdf' }, headers: auth_headers(org)

      expect(response).to have_http_status(:ok)
      expect(response.body).to start_with('%PDF')
      expect(rendered_text.join("\n")).to include(label)
      if status == 'not_found'
        expect(rendered_text.join("\n")).not_to include(quote)
      else
        expect(rendered_text.join("\n")).to include(quote)
      end
    end
  end
end
