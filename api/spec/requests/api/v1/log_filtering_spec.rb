# frozen_string_literal: true

require 'rails_helper'

# F-18: parameter berisi data pribadi kandidat atau penilaian asesor tidak boleh
# tertulis apa adanya di log aplikasi (UU PDP; brief: "no sensitive personal data in logs").
RSpec.describe 'Parameter log filtering', type: :request do
  let(:log_output) { StringIO.new }

  around do |example|
    original_rails_logger = Rails.logger
    original_controller_logger = ActionController::Base.logger
    logger = ActiveSupport::Logger.new(log_output)
    Rails.logger = logger
    ActionController::Base.logger = logger
    example.run
  ensure
    Rails.logger = original_rails_logger
    ActionController::Base.logger = original_controller_logger
  end

  it 'menyaring nama kandidat saat membuat sesi' do
    assessment = with_tenant { Assessment.create!(name: 'Assessment Log', time_limit_min: 10, created_by: 1) }

    post "/api/v1/assessments/#{assessment.id}/sessions",
         params: { session: { candidate_name: 'Nama Kandidat Rahasia' } }, headers: auth_headers, as: :json

    expect(response).to have_http_status(:created)
    expect(log_output.string).not_to include('Nama Kandidat Rahasia')
    expect(log_output.string).to include('[FILTERED]')
  end

  it 'menyaring alasan override asesor' do
    skill = create_portfolio_for(test_organization)[:skill]

    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: 2, assessor_notes: 'Penilaian rahasia tentang kandidat.' } },
         headers: auth_headers, as: :json

    expect(log_output.string).not_to include('Penilaian rahasia tentang kandidat.')
    expect(log_output.string).to include('[FILTERED]')
  end

  it 'menyaring password pada login' do
    post '/api/v1/auth/login', params: { email: 'fiktif@example.test', password: 'KataSandiRahasia123' }, as: :json

    expect(log_output.string).not_to include('KataSandiRahasia123')
  end
end
