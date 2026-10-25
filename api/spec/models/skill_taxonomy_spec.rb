# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SkillTaxonomy, type: :model do
  describe 'validations' do
    it 'validates presence of essential taxonomy attributes and anchors' do
      taxonomy = SkillTaxonomy.new
      expect(taxonomy).not_to be_valid

      %i[skill_id skill_label category l1_anchor l2_anchor l3_anchor l4_anchor l5_anchor].each do |attr|
        expect(taxonomy.errors[attr]).to be_present
      end
    end

    it 'defines valid categories' do
      expect(SkillTaxonomy::CATEGORIES).to contain_exactly('engineering', 'soft_skills', 'product_process')
    end
  end
end
