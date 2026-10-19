# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Api::V1::AssessmentsController, type: :controller do
  it 'filters assessments by a case-insensitive, escaped name search' do
    scope = double('assessment scope')
    page = double('paginated assessments', current_page: 1, total_pages: 1, total_count: 0, limit_value: 10)
    authorizer = instance_double(AuthorizeApiRequest, call: { user: OpenStruct.new(id: 1, role: 'assessor') })

    Current.organization = OpenStruct.new(id: 1)
    allow(AuthorizeApiRequest).to receive(:new).and_return(authorizer)
    allow(Assessment).to receive(:active).and_return(scope)
    allow(scope).to receive(:includes).with(:sessions, :assessment_skills).and_return(scope)
    allow(scope).to receive(:order).with(created_at: :desc).and_return(scope)
    expect(scope).to receive(:where).with('name ILIKE ?', '%Dev\\%\\_%').and_return(scope)
    expect(controller).to receive(:paginate).with(scope, per_page: 10).and_return(page)
    allow(page).to receive(:map).and_return([])

    get :index, params: { search: 'Dev%_', page: 2 }

    expect(response).to have_http_status(:ok)
  end

  it 'serializes skill and candidate summaries for the assessment list' do
    session = lambda do |status, end_reason, day|
      double('session', {
        id: day,
        status:,
        end_reason:,
        created_at: Time.utc(2026, 1, day),
        :'pending?' => status == 'pending',
        :'active?' => status == 'active',
        :'ended?' => status == 'ended'
      })
    end
    sessions = [
      session.call('pending', nil, 1),
      session.call('active', nil, 2),
      session.call('ended', 'manual_assessor', 3),
      session.call('ended', 'error', 4),
      session.call('failed', 'error', 5)
    ]
    skills = (1..4).map { |order| OpenStruct.new(display_order: order, skill_label: "Skill #{order}") }
    assessment = OpenStruct.new(
      id: 1,
      name: 'Backend Developer',
      time_limit_min: 45,
      language: 'en',
      system_prompt: nil,
      created_by: 1,
      created_at: Time.utc(2026, 1, 1),
      updated_at: Time.utc(2026, 1, 1),
      sessions:,
      assessment_skills: skills
    )

    result = controller.send(:assessment_json, assessment)

    expect(result[:skill_count]).to eq(4)
    expect(result[:skill_preview]).to eq(['Skill 1', 'Skill 2', 'Skill 3'])
    expect(result[:session_summary]).to eq(total: 5, pending: 1, active: 1, completed: 1, failed: 2)
  end
end
