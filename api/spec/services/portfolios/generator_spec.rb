# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator, type: :service do
  let(:session_double) { double('Session') }

  subject { described_class.new(session: session_double, gemini_client: nil) }

  describe '#validate_portfolio_response!' do
    it 'raises when response is not a hash' do
      expect { subject.send(:validate_portfolio_response!, 'not a hash') }.to raise_error(/expected Hash/)
    end

    it 'raises when configured_skills is not an array' do
      data = { 'configured_skills' => 'bad' }
      expect { subject.send(:validate_portfolio_response!, data) }.to raise_error(/must be an Array/)
    end

    it 'raises when a skill is missing skill_label' do
      data = { 'configured_skills' => [{ 'level' => 3, 'evidence' => [] }] }
      expect { subject.send(:validate_portfolio_response!, data) }.to raise_error(/skill_label missing/)
    end

    it 'raises when level is out of range' do
      data = { 'configured_skills' => [{ 'skill_label' => 'X', 'level' => 10, 'evidence' => [] }] }
      expect { subject.send(:validate_portfolio_response!, data) }.to raise_error(/level missing or out of range/)
    end

    it 'accepts a valid structure' do
      data = {
        'configured_skills' => [
          { 'skill_label' => 'React', 'level' => 3, 'evidence' => ['quote1'] }
        ]
      }
      expect { subject.send(:validate_portfolio_response!, data) }.not_to raise_error
    end
  end
end
