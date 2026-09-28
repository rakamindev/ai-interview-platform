# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Session hiring decisions', type: :request do
  let!(:organization) do
    Organization.create!(
      name: 'Acme Indonesia',
      scheme: 'acme-test',
      identifier: 'acme-test',
      host: 'acme-test.local'
    )
  end
  let(:external_actor_id) { 900_001 }
  let!(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: external_actor_id,
      name: 'Fullstack Engineer',
      time_limit_min: 30,
      language: 'id'
    )
  end
  let!(:session) do
    Session.create!(
      tenant_id: organization.id,
      assessment: assessment,
      candidate_name: 'Kandidat Uji',
      status: 'ended',
      ended_at: Time.current
    )
  end
  let!(:portfolio) do
    Portfolio.create!(
      session: session,
      generation_status: 'complete',
      generated_at: Time.current
    )
  end
  let(:token) do
    JsonWebToken.encode(
      user_id: external_actor_id,
      role: 'admin',
      scheme: organization.scheme
    )
  end
  let(:headers) do
    {
      'Authorization' => "Bearer #{token}",
      'Content-Type' => 'application/json'
    }
  end

  it 'menyimpan keputusan manusia beserta alasan dan audit actor' do
    patch "/api/v1/sessions/#{session.id}/decision",
          params: { decision: { value: 'advance', notes: 'Bukti teknis memenuhi kebutuhan peran.' } }.to_json,
          headers: headers

    expect(response).to have_http_status(:ok)
    expect(User.find_by(id: external_actor_id)).to be_nil
    expect(session.reload).to have_attributes(
      hiring_decision: 'advance',
      decision_notes: 'Bukti teknis memenuhi kebutuhan peran.',
      decided_by: external_actor_id
    )
    expect(session.decided_at).to be_present
  end

  it 'menolak keputusan tanpa alasan' do
    patch "/api/v1/sessions/#{session.id}/decision",
          params: { decision: { value: 'reject', notes: '  ' } }.to_json,
          headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    expect(session.reload.hiring_decision).to be_nil
  end

  it 'menolak nilai keputusan di luar pilihan yang didukung' do
    patch "/api/v1/sessions/#{session.id}/decision",
          params: { decision: { value: 'auto_reject', notes: 'Nilai ini tidak didukung.' } }.to_json,
          headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    expect(session.reload.hiring_decision).to be_nil
  end

  it 'menolak keputusan sebelum laporan selesai dibuat' do
    portfolio.update!(generation_status: 'generating')

    patch "/api/v1/sessions/#{session.id}/decision",
          params: { decision: { value: 'hold', notes: 'Menunggu bukti tambahan.' } }.to_json,
          headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    expect(session.reload.hiring_decision).to be_nil
  end

  it 'menolak request tanpa autentikasi' do
    patch "/api/v1/sessions/#{session.id}/decision",
          params: { decision: { value: 'advance', notes: 'Tidak boleh tersimpan.' } }.to_json,
          headers: { 'X-Tenant-Scheme' => organization.scheme, 'Content-Type' => 'application/json' }

    expect(response).to have_http_status(:unauthorized)
    expect(session.reload.hiring_decision).to be_nil
  end

  it 'menyertakan status portfolio pada candidate list' do
    get "/api/v1/assessments/#{assessment.id}/sessions", headers: headers

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('sessions', 0, 'portfolio_status')).to eq('complete')
  end
end
