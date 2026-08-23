# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Current, type: :model do
  describe '.class_accessor' do
    it 'stores and retrieves values via RequestStore' do
      Current.user = 'test_user'
      expect(Current.user).to eq('test_user')
    end

    it 'raises when not set and no block given' do
      Current.clear
      expect { Current.tenant_id }.to raise_error(RuntimeError, /please set Current.tenant_id/)
    end

    it 'returns block result when not set' do
      Current.clear
      expect(Current.organization { 'fallback' }).to eq('fallback')
    end

    it 'clears all values' do
      Current.user = 'test'
      Current.clear
      expect(RequestStore.store).to be_empty
    end
  end

  describe '.using' do
    it 'temporarily sets attributes' do
      Current.user = 'original'
      Current.using(user: 'temp') do
        expect(Current.user).to eq('temp')
      end
      expect(Current.user).to eq('original')
    end
  end

  describe '.after_clear' do
    it 'runs callbacks on clear' do
      called = false
      Current.after_clear { called = true }
      Current.clear
      expect(called).to be true
    end
  end
end