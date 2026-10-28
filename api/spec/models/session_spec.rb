# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:organization) do
    Organization.create!(
      name: 'Alpha Corp',
      scheme: 'alpha-corp',
      identifier: 'alpha',
      host: 'alpha.example.com'
    )
  end

  let(:user) do
    User.create!(
      email: 'creator@alpha.com',
      password: 'password123',
      password_confirmation: 'password123',
      role: 'admin'
    )
  end

  let(:assessment) do
    Current.using(tenant_id: organization.id) do
      Assessment.create!(
        name: 'Backend Engineer Assessment',
        time_limit_min: 30,
        created_by: user.id
      )
    end
  end

  subject(:session) do
    Current.using(tenant_id: organization.id) do
      Session.create!(
        assessment: assessment,
        candidate_name: 'Budi Santoso'
      )
    end
  end

  describe 'validations and callbacks' do
    it 'generates a 64-char hexadecimal invite token on create' do
      expect(session.invite_token).to be_present
      expect(session.invite_token.length).to eq(64)
    end

    it 'enforces uniqueness of invite_token' do
      duplicate = Current.using(tenant_id: organization.id) do
        Session.new(
          assessment: assessment,
          invite_token: session.invite_token
        )
      end
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:invite_token]).to be_present
    end
  end

  describe '#invite_url' do
    context 'when FRONTEND_URL is set in environment' do
      it 'uses FRONTEND_URL and points to the frontend interview route' do
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with('FRONTEND_URL').and_return('http://localhost:5173')

        expect(session.invite_url).to eq("http://localhost:5173/interview/#{session.invite_token}")
      end

      it 'strips trailing slashes from FRONTEND_URL cleanly' do
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with('FRONTEND_URL').and_return('https://interview.example.com/')

        expect(session.invite_url).to eq("https://interview.example.com/interview/#{session.invite_token}")
      end
    end

    context 'in development environment when FRONTEND_URL is not set' do
      it 'defaults to frontend dev port 5173 instead of backend port 3001' do
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with('FRONTEND_URL').and_return(nil)
        allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new('development'))

        expect(session.invite_url).to eq("http://localhost:5173/interview/#{session.invite_token}")
      end
    end
  end
end
