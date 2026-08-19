require 'rails_helper'

RSpec.describe Message do
  describe '.not_found' do
    it 'returns generic message when no argument is given' do
      expect(described_class.not_found).to eq('Sorry, record not found.')
    end

    it 'returns specific message when argument is given' do
      expect(described_class.not_found('User')).to eq('Sorry, User not found.')
    end
  end

  describe 'static messages' do
    it 'returns correct strings' do
      expect(described_class.invalid_credentials).to eq('Invalid credentials')
      expect(described_class.invalid_token).to eq('Invalid token')
      expect(described_class.missing_token).to eq('Missing token')
      expect(described_class.unauthorized).to eq('Unauthorized request')
      expect(described_class.tenant_not_found).to eq('Tenant not found. Ensure the JWT scheme claim is valid.')
      expect(described_class.assessment_error).to eq('Assessment not found or does not belong to your organization.')
      expect(described_class.session_not_active).to eq('Session is not active.')
    end
  end
end
