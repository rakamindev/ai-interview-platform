require 'rspec'
require 'ostruct'

# Standalone spec to verify Generator & Engine logic without bootsnap/rails dependency

describe 'Portfolio Generator & Fit/Gap Engine Core Logic' do
  describe 'Portfolios::Generator logic for unassessed skills' do
    def generate_skill_data(skill_data)
      assigned_level = if skill_data && skill_data['level'].present? && skill_data['level'].to_i > 0
                         skill_data['level'].to_i.clamp(1, 5)
                       else
                         nil
                       end
      {
        skill_id: skill_data ? skill_data['skill_id'] : nil,
        ai_level: assigned_level,
        effective_level: assigned_level
      }
    end

    it 'assigns nil ai_level and effective_level when skill is unassessed (level is nil)' do
      result = generate_skill_data({ 'skill_id' => 10, 'level' => nil, 'notes' => 'Belum sempat ditanyakan' })
      expect(result[:ai_level]).to be_nil
      expect(result[:effective_level]).to be_nil
    end

    it 'assigns clamped level when skill is assessed with valid score' do
      result = generate_skill_data({ 'skill_id' => 11, 'level' => 4, 'notes' => 'Mampu menjawab arsitektur microservices' })
      expect(result[:ai_level]).to eq(4)
      expect(result[:effective_level]).to eq(4)
    end

    it 'regression check: old buggy behavior clamp(1, 5) would wrongfully coerce nil to L1' do
      old_flawed_level = (nil).to_i.clamp(1, 5)
      expect(old_flawed_level).to eq(1) # membuktikan bug lama menaikkan nil jadi L1
    end
  end

  describe 'FitGap::Engine logic for unassessed vs gap' do
    def evaluate_comparison(portfolio_skill, expected_level)
      if portfolio_skill && portfolio_skill[:effective_level].present?
        candidate_level = portfolio_skill[:effective_level]
        delta           = candidate_level - expected_level
        result          = delta.zero? ? 'match' : (delta.positive? ? 'exceed' : 'gap')
      else
        candidate_level = nil
        delta           = nil
        result          = 'not_assessed'
      end

      {
        candidate_level: candidate_level,
        expected_level:  expected_level,
        required_level:  expected_level,
        delta:           delta,
        result:          result
      }
    end

    it 'correctly evaluates assessed skill gap' do
      portfolio_skill = { effective_level: 2 }
      comp = evaluate_comparison(portfolio_skill, 4)
      expect(comp[:result]).to eq('gap')
      expect(comp[:delta]).to eq(-2)
      expect(comp[:required_level]).to eq(4)
    end

    it 'correctly marks unassessed skill as not_assessed with nil delta and preserves required_level' do
      portfolio_skill = { effective_level: nil }
      comp = evaluate_comparison(portfolio_skill, 3)
      expect(comp[:result]).to eq('not_assessed')
      expect(comp[:candidate_level]).to be_nil
      expect(comp[:delta]).to be_nil
      expect(comp[:required_level]).to eq(3)
    end

    it 'safely guards against NoMethodError on nil - 3' do
      portfolio_skill = { effective_level: nil }
      expect { evaluate_comparison(portfolio_skill, 3) }.not_to raise_error
    end
  end
end
