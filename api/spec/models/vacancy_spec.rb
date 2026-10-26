# frozen_string_literal: true

require "rails_helper"

RSpec.describe Vacancy, type: :model do
  def build_vacancy(**attrs)
    Vacancy.new({ role_title: "Software Engineer", tenant_id: 1 }.merge(attrs))
  end

  describe "role_title validations" do
    it "is valid with a role_title within 100 characters" do
      v = build_vacancy(role_title: "A" * 100)
      v.valid?
      expect(v.errors[:role_title]).to be_empty
    end

    it "is invalid when role_title exceeds 100 characters" do
      v = build_vacancy(role_title: "A" * 101)
      expect(v).not_to be_valid
      expect(v.errors[:role_title]).to include("must be 100 characters or fewer")
    end

    it "is invalid without a role_title" do
      v = build_vacancy(role_title: nil)
      expect(v).not_to be_valid
      expect(v.errors[:role_title]).to include("can't be blank")
    end
  end

  describe "narrative field validations (F-06)" do
    it "is valid when culture_dimensions is within 500 characters" do
      v = build_vacancy(culture_dimensions: "A" * 500)
      v.valid?
      expect(v.errors[:culture_dimensions]).to be_empty
    end

    it "is invalid when culture_dimensions exceeds 500 characters" do
      v = build_vacancy(culture_dimensions: "A" * 501)
      expect(v).not_to be_valid
      expect(v.errors[:culture_dimensions]).to include("must be 500 characters or fewer")
    end

    it "is valid when competency_expectations is within 500 characters" do
      v = build_vacancy(competency_expectations: "A" * 500)
      v.valid?
      expect(v.errors[:competency_expectations]).to be_empty
    end

    it "is invalid when competency_expectations exceeds 500 characters" do
      v = build_vacancy(competency_expectations: "A" * 501)
      expect(v).not_to be_valid
      expect(v.errors[:competency_expectations]).to include("must be 500 characters or fewer")
    end
  end
end
