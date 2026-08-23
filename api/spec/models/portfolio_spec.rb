# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio, type: :model do
  describe 'validations' do
    let(:session) { create(:session) }
    subject { build(:portfolio, session: session) }

    it 'is valid with valid attributes' do
      expect(subject).to be_valid
    end

    it 'validates generation_status inclusion' do
      subject.generation_status = 'unknown'
      expect(subject).not_to be_valid
    end
  end

  describe 'status helper methods' do
    it 'reports correct status flags' do
      complete = build(:portfolio, generation_status: 'complete')
      generating = build(:portfolio, generation_status: 'generating')
      failed = build(:portfolio, generation_status: 'failed')

      expect(complete).to be_complete
      expect(generating).to be_generating
      expect(failed).to be_failed
    end
  end
end
