require './config/environment'
require 'rspec/mocks'
RSpec::Mocks.setup
RequestStore.store[:tenant_id] = nil
Current.tenant_id = nil
org = Organization.create!(name: 'Test', scheme: 'test2', identifier: 'test2', host: 'test2.com')
Current.tenant_id = org.id
assessment = Assessment.create!(name: 'A', time_limit_min: 30, created_by: 1)
vacancy = Vacancy.create!(assessment: assessment, title: 'T', description: 'D', status: 'open', created_by: 1)
session = Session.create!(assessment: assessment, tenant_id: org.id)
portfolio = Portfolio.create!(session: session, candidate_name: 'C', candidate_email: 'c@c.com')
gemini = double('Gemini::LiveClient')
allow(gemini).to receive(:generate_content).and_return({'culture_narrative' => 'C', 'overall_narrative' => 'O'}.to_json)
engine = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini)
report = engine.call
puts 'Report: ' + report.inspect
puts 'Skill comparisons class: ' + report.skill_comparisons.class.name
puts 'Skill comparisons: ' + report.skill_comparisons.inspect
