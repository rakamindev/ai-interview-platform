# frozen_string_literal: true

require 'rails_helper'

# F-04 & F-05: overrides need a reason, and every change is kept in an
# append-only history written atomically with the current override.
RSpec.describe 'Assessor override audit', type: :request do
  let(:data)    { create_portfolio_for(test_organization, ai_level: 3) }
  let(:skill)   { data[:skill] }
  let(:headers) { auth_headers(role: 'admin', user_id: 7) }
  let(:valid_reason) { 'Jawaban desain indeks belum menunjukkan trade-off.' }

  def override!(level:, reason:, as_headers: headers)
    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: level, assessor_notes: reason } }, headers: as_headers, as: :json
  end

  def events
    AssessorOverrideEvent.where(portfolio_skill_id: skill.id)
  end

  describe 'reason validation' do
    [
      ['empty', ''],
      ['whitespace-only', "   \n\t  "],
      ['9-character', 'a' * 9],
      ['1001-character', 'a' * 1001]
    ].each do |label, reason|
      it "rejects a #{label} reason without changing state or history" do
        override!(level: 2, reason: reason)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json.dig('errors', 0, 'message')).to match(/reason/i)
        expect(AssessorOverride.where(portfolio_skill_id: skill.id)).to be_empty
        expect(events).to be_empty
      end
    end

    it 'accepts a reason of exactly 10 characters (inclusive lower bound)' do
      override!(level: 2, reason: 'a' * 10)
      expect(response).to have_http_status(:created)
    end

    it 'accepts a reason of exactly 1000 characters (inclusive upper bound) and stores it trimmed' do
      override!(level: 2, reason: "  #{'a' * 1000}  ")

      expect(response).to have_http_status(:created)
      expect(events.last.reason).to eq('a' * 1000)
    end
  end

  describe 'level validation' do
    it 'rejects an override to the current effective level' do
      override!(level: 3, reason: valid_reason)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig('errors', 0, 'message')).to match(/unchanged/i)
      expect(events).to be_empty
    end

    it 'rejects a level outside 1..5' do
      override!(level: 9, reason: valid_reason)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(events).to be_empty
    end

    it 'rejects an override while the portfolio is not complete' do
      pending_skill = create_portfolio_for(test_organization, status: 'generating')[:skill]

      post "/api/v1/portfolio_skills/#{pending_skill.id}/override",
           params: { override: { override_level: 2, assessor_notes: valid_reason } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(AssessorOverrideEvent.where(portfolio_skill_id: pending_skill.id)).to be_empty
    end

    it 'still rejects a candidate token (role student)' do
      override!(level: 2, reason: valid_reason, as_headers: auth_headers(role: 'student', user_id: 2))
      expect(response).to have_http_status(:forbidden)
      expect(events).to be_empty
    end
  end

  describe 'append-only history' do
    it 'the first override records one complete event' do
      override!(level: 2, reason: valid_reason)

      expect(response).to have_http_status(:created)
      expect(events.count).to eq(1)
      event = events.first
      expect(event).to have_attributes(previous_level: 3, new_level: 2, ai_level: 3, reason: valid_reason,
                                       actor_id: 7, legacy: false)
    end

    it 'a second override keeps the first reason' do
      override!(level: 2, reason: valid_reason)
      override!(level: 1, reason: 'Setelah membaca ulang transkrip, contoh query tidak ada.')

      expect(response).to have_http_status(:ok)
      expect(events.count).to eq(2)
      expect(events.order(:id).pluck(:previous_level, :new_level, :reason)).to eq([
        [3, 2, valid_reason],
        [2, 1, 'Setelah membaca ulang transkrip, contoh query tidak ada.']
      ])
      expect(skill.reload.assessor_override.override_level).to eq(1)
    end

    it 'allows going back to the AI level and records it as an event' do
      override!(level: 2, reason: valid_reason)
      override!(level: 3, reason: 'Setuju dengan penilaian AI setelah diskusi panel.')

      expect(response).to have_http_status(:ok)
      expect(events.order(:id).last).to have_attributes(previous_level: 2, new_level: 3)
    end

    it 'a saved event cannot be changed' do
      override!(level: 2, reason: valid_reason)

      expect { events.first.update!(reason: 'diubah diam-diam') }.to raise_error(ActiveRecord::ReadOnlyRecord)
    end

    it 'the portfolio includes history per skill, newest first' do
      override!(level: 2, reason: valid_reason)
      override!(level: 1, reason: 'Setelah membaca ulang transkrip, contoh query tidak ada.')

      get "/api/v1/sessions/#{data[:session].id}/portfolio", headers: headers

      history = json['portfolio']['skills'].first['override_history']
      expect(history.map { |e| e['new_level'] }).to eq([1, 2])
      expect(history.first).to include('previous_level' => 2, 'ai_level' => 3, 'actor_id' => 7, 'legacy' => false)
    end
  end

  describe 'atomicity' do
    it 'does not change the override when saving history fails' do
      override!(level: 2, reason: valid_reason)
      allow_any_instance_of(AssessorOverrideEvent).to receive(:save!).and_raise(ActiveRecord::RecordNotSaved, 'simulasi gagal')

      override!(level: 1, reason: 'Percobaan yang seharusnya dibatalkan seluruhnya.')

      expect(response).not_to have_http_status(:success)
      expect(skill.reload.assessor_override.override_level).to eq(2)
      expect(events.count).to eq(1)
    end
  end
end
