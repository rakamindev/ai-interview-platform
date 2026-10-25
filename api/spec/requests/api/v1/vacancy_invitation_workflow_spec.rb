require 'rails_helper'

RSpec.describe 'Vacancy & Invitation Workflow', type: :request do
  let(:user) { create(:user, :admin, password: 'secure_password123') }
  let(:tenant) { Organization.first || Organization.create!(identifier: 'test', name: 'Test', scheme: 'test', host: 'test.com') }
  let(:base_headers) do
  token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: tenant.scheme)
  { 'X-Tenant-Scheme' => tenant.scheme, 'Content-Type' => 'application/json', 'Authorization' => "Bearer #{token}" }
end

  describe 'Vacancy to Assessment connection' do
    let(:vacancy) { Vacancy.create!(role_title: 'Backend Dev', tenant_id: tenant.id, created_by: user.id) }
let!(:vacancy_skill) { VacancySkill.create!(vacancy_id: vacancy.id, skill_id: 'ruby', skill_label: 'Ruby', expected_level: 4) }
it '1. Existing assessment without vacancy remains valid (can be created)' do
      attributes = {
        name: 'Standalone Role', time_limit_min: 45, language: 'en',
        assessment_skills_attributes: [{ skill_id: 'java', skill_label: 'Java', expected_level: 3, l1_anchor: '1', l2_anchor: '2', l3_anchor: '3', l4_anchor: '4', l5_anchor: '5' }]
      }
      post '/api/v1/assessments', headers: base_headers, params: { assessment: attributes }, as: :json
      puts response.body; expect(response).to have_http_status(:created)
      expect(Assessment.last.vacancy_id).to be_nil
    end

    it '10, 11, 12. Vacancy can create an assessment and prefill assessment skills' do
      attributes = {
        name: vacancy.role_title,
        vacancy_id: vacancy.id,
        time_limit_min: 30,
        language: 'en',
        assessment_skills_attributes: [
          { skill_id: vacancy_skill.skill_id, skill_label: vacancy_skill.skill_label, expected_level: 4, l1_anchor: '1', l2_anchor: '2', l3_anchor: '3', l4_anchor: '4', l5_anchor: '5' }
        ]
      }
      post '/api/v1/assessments', headers: base_headers, params: { assessment: attributes }, as: :json
      
      puts response.body; expect(response).to have_http_status(:created)
      assessment = Assessment.last
      expect(assessment.vacancy_id).to eq(vacancy.id)
      expect(assessment.assessment_skills.first.skill_id).to eq('ruby')
    end
  end

  describe 'Email Invitation Workflow' do
    let(:assessment) { create(:assessment, tenant_id: tenant.id) }

    it '2, 4. Session can store candidate email and starts with pending invitation' do
      post "/api/v1/assessments/#{assessment.id}/sessions", 
           headers: base_headers, 
           params: { session: { candidate_name: 'Bob', candidate_email: 'bob@example.com' } }, as: :json
           
      puts response.body; expect(response).to have_http_status(:created)
      session = Session.last
      expect(session.candidate_email).to eq('bob@example.com')
      expect(session.invitation_status).to eq('pending')
    end

    it '3. Invalid email is rejected' do
      post "/api/v1/assessments/#{assessment.id}/sessions", 
           headers: base_headers, 
           params: { session: { candidate_name: 'Bob', candidate_email: 'not-an-email' } }, as: :json
           
      expect(response).to have_http_status(:unprocessable_entity)
    end

    context 'sending limits and state transitions' do
      let(:session) { create(:session, assessment: assessment, tenant_id: tenant.id, candidate_email: 'alice@example.com', invitation_status: 'pending') }

      it '5, 6, 9. Invitation can be sent, changes status, and duplicate send prevented' do
        require 'sidekiq/testing'
        Sidekiq::Testing.inline!
        
        post "/api/v1/sessions/#{session.id}/invitation", headers: base_headers
        expect(response).to have_http_status(:success)
        expect(session.reload.invitation_status).to eq('sent')
        
        # 9. Duplicate prevent
        post "/api/v1/sessions/#{session.id}/invitation", headers: base_headers
        expect(response).to have_http_status(:unprocessable_entity)
        expect(JSON.parse(response.body)['errors'][0]['message']).to eq('Invitation already sent')
      end
    end
    
    context 'Sidkiq Worker Failure handling' do
      let(:session) { create(:session, assessment: assessment, tenant_id: tenant.id, candidate_email: 'alice@test.example', invitation_status: 'pending') }
      
      it '7, 8. Worker failed attempt keeps status pending (retry available), and retry works' do
        allow(CandidateMailer).to receive(:with).and_raise(StandardError.new("SMTP Down"))
        
        expect {
          InvitationSenderWorker.new.perform(session.id)
        }.to raise_error("SMTP Down")
        
        # 7. After a single failed attempt, status remains 'pending' because Sidekiq will retry.
        # Only after ALL retries are exhausted (sidekiq_retries_exhausted) will it become 'failed'.
        # The last error message is recorded for observability.
        expect(session.reload.invitation_status).to eq('pending')
        expect(session.invitation_error).to include("SMTP Down")
        
        # 8. Retry works through controller point (pending allows retry)
        Sidekiq::Testing.inline!
        allow(CandidateMailer).to receive(:with).and_call_original
        post "/api/v1/sessions/#{session.id}/invitation", headers: base_headers
        expect(response).to have_http_status(:success)
        expect(session.reload.invitation_status).to eq('sent')
      end
    end
  end
end
