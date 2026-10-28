# frozen_string_literal: true

require 'rails_helper'

# AC-20 to AC-28, AC-30: assessor overrides need a note, keep an append-only
# history, can be reverted, and are protected against lost updates.
RSpec.describe 'Portfolio skill overrides' do
  let(:organization) { create(:organization) }
  let(:portfolio)    { create(:portfolio, session: create(:session, assessment: create(:assessment, organization: organization))) }
  let!(:skill)       { create(:portfolio_skill, portfolio: portfolio, skill_label: 'SQL & Data Modeling', ai_level: 2, ai_confidence: 'medium') }
  let(:headers)      { auth_headers_for(organization, user_id: 7).merge('Content-Type' => 'application/json') }

  def override!(body)
    post "/api/v1/portfolio_skills/#{skill.id}/override", params: { override: body }.to_json, headers: headers
  end

  def revert!(body)
    delete "/api/v1/portfolio_skills/#{skill.id}/override", params: body.to_json, headers: headers
  end

  def events
    AssessorOverrideEvent.where(portfolio_skill: skill).order(:id)
  end

  describe 'POST /portfolio_skills/:id/override' do
    it 'rejects an override without a note and writes nothing (AC-20)' do
      ['', '   ', nil].each do |notes|
        override!(level: 3, notes: notes)

        expect(response).to have_http_status(:unprocessable_entity)
      end
      expect(AssessorOverride.count).to eq(0)
      expect(events).to be_empty
    end

    it 'stores the override and appends a set event with from, to, AI level, note and actor (AC-21)' do
      override!(level: 3, notes: 'Contoh catatan: studi kasus tertulis kuat.')

      expect(response).to have_http_status(:created)
      expect(skill.reload.assessor_override).to have_attributes(override_level: 3, ai_level: 2, overridden_by: 7)
      expect(events.map { |e| e.slice(:action, :from_level, :to_level, :ai_level_at_time, :notes, :actor_id) })
        .to eq([{ 'action' => 'set', 'from_level' => 2, 'to_level' => 3, 'ai_level_at_time' => 2,
                  'notes' => 'Contoh catatan: studi kasus tertulis kuat.', 'actor_id' => 7 }])
    end

    it 'keeps accepting the original parameter names' do
      override!(override_level: 4, assessor_notes: 'Contoh catatan.')

      expect(response).to have_http_status(:created)
      expect(skill.reload.assessor_override.override_level).to eq(4)
    end

    it 'rejects an override to the current effective level as no change (AC-22)' do
      override!(level: 2, notes: 'Contoh catatan.')

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body.dig('errors', 0, 'message')).to match(/no change/i)
    end

    it 'records every change of an existing override in the history' do
      override!(level: 3, notes: 'Contoh catatan pertama.')
      override!(level: 4, notes: 'Contoh catatan kedua.', lock_version: response.parsed_body.dig('override', 'lock_version'))

      expect(response).to have_http_status(:ok)
      expect(events.pluck(:from_level, :to_level)).to eq([[2, 3], [3, 4]])
    end

    it 'returns 409 for a stale lock_version and loses no event (AC-27)' do
      override!(level: 3, notes: 'Contoh catatan pertama.')
      version = response.parsed_body.dig('override', 'lock_version')
      override!(level: 4, notes: 'Asesor A.', lock_version: version)
      override!(level: 5, notes: 'Asesor B dengan versi lama.', lock_version: version)

      expect(response).to have_http_status(:conflict)
      expect(skill.reload.assessor_override.override_level).to eq(4)
      expect(events.pluck(:to_level)).to eq([3, 4])
    end

    it 'rejects a level outside 1 to 5 and a note longer than 2,000 characters (AC-28)' do
      override!(level: 6, notes: 'Contoh catatan.')
      expect(response).to have_http_status(:unprocessable_entity)

      override!(level: 3, notes: 'x' * 2_001)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(events).to be_empty
    end

    it 'lets an assessor rate a not-assessed skill, from no level (AC-26)' do
      skill.update!(rating_status: 'not_assessed', not_assessed_reason: 'not_covered', ai_level: nil, ai_confidence: nil)

      override!(level: 3, notes: 'Contoh: dinilai dari tugas tertulis.')

      expect(response).to have_http_status(:created)
      expect(events.last).to have_attributes(from_level: nil, to_level: 3, ai_level_at_time: nil)
    end
  end

  describe 'DELETE /portfolio_skills/:id/override (AC-23)' do
    before { override!(level: 3, notes: 'Contoh catatan.') }

    it 'reverts to the AI level and appends a revert event' do
      revert!(notes: 'Contoh: salah input.')

      expect(response).to have_http_status(:ok)
      expect(skill.reload.assessor_override).to be_nil
      expect(events.last).to have_attributes(action: 'revert', from_level: 3, to_level: 2, notes: 'Contoh: salah input.')
    end

    it 'requires a note' do
      revert!(notes: ' ')

      expect(response).to have_http_status(:unprocessable_entity)
      expect(skill.reload.assessor_override).to be_present
    end

    it 'returns 404 when there is no override to revert' do
      revert!(notes: 'Contoh.')
      revert!(notes: 'Contoh lagi.')

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /portfolio_skills/:id/override_events' do
    it 'lists the history newest first' do
      override!(level: 3, notes: 'Contoh satu.')
      revert!(notes: 'Contoh dua.')

      get "/api/v1/portfolio_skills/#{skill.id}/override_events", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['events'].pluck('action')).to eq(%w[revert set])
    end
  end

  describe 'POST /portfolio_skills/:id/confirm (AC-30)' do
    def confirm!(body = {})
      post "/api/v1/portfolio_skills/#{skill.id}/confirm", params: body.to_json, headers: headers
    end

    it 'records a confirm event without changing the level; the note is optional' do
      confirm!

      expect(response).to have_http_status(:created)
      expect(events.last).to have_attributes(action: 'confirm', from_level: 2, to_level: 2, notes: nil, actor_id: 7)
      expect(skill.reload).to have_attributes(ai_level: 2, assessor_override: nil)
    end

    # Confirming a low-confidence rating moves it from follow-up into the fit
    # totals, so the human review must say why (Pasal 10), as for overrides.
    it 'requires a note to confirm a low-confidence rating' do
      skill.update!(ai_confidence: 'low')

      confirm!
      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body.dig('errors', 0, 'code')).to eq('note_required')
      expect(events).to be_empty

      confirm!(notes: '  ')
      expect(response).to have_http_status(:unprocessable_entity)

      confirm!(notes: 'Contoh: bukti tambahan dari tugas tertulis.')
      expect(response).to have_http_status(:created)
      expect(events.last).to have_attributes(action: 'confirm', notes: 'Contoh: bukti tambahan dari tugas tertulis.')
    end

    it 'still allows confirming a high-confidence rating without a note' do
      skill.update!(ai_confidence: 'high')

      confirm!

      expect(response).to have_http_status(:created)
    end

    it 'cannot confirm a not-assessed skill' do
      skill.update!(rating_status: 'not_assessed', not_assessed_reason: 'not_covered', ai_level: nil, ai_confidence: nil)

      confirm!(notes: 'Contoh.')

      expect(response).to have_http_status(:unprocessable_entity)
      expect(events).to be_empty
    end

    it 'shows the confirmation on the portfolio skill' do
      confirm!

      get "/api/v1/sessions/#{portfolio.session_id}/portfolio", headers: headers
      json_skill = response.parsed_body.dig('portfolio', 'skills').find { |s| s['id'] == skill.id }
      expect(json_skill['assessor_confirmed']).to be(true)
    end
  end
end
