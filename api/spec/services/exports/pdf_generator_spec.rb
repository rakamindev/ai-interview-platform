# frozen_string_literal: true

require 'rails_helper'

# The PDF is the official decision document (Q4), so it must say what the
# screen says. These examples read the text of the rendered PDF with
# pdf-reader instead of checking a view model.
RSpec.describe Exports::PdfGenerator do
  let(:portfolio) { create(:portfolio, ratings_validated: true) }
  let(:vacancy)   { create(:vacancy, role_title: 'Contoh Backend Engineer') }

  def render_pdf(with_vacancy: vacancy)
    described_class.new(portfolio: portfolio, vacancy: with_vacancy).call
  end

  def pdf_pages(pdf = render_pdf)
    PDF::Reader.new(StringIO.new(pdf)).pages
  end

  # Text of the whole document with the page footers removed (so text running
  # over a page break reads as one piece) and layout spacing collapsed.
  def pdf_text(pdf = render_pdf)
    pdf_pages(pdf).map { |page| page.text.sub(/Page \d+ of \d+\s*\z/, '') }.join("\n").gsub(/\s+/, ' ').strip
  end

  def require_skill(label, level)
    create(:vacancy_skill, vacancy: vacancy, skill_label: label, expected_level: level)
  end

  def rated(label, level, confidence: 'high', probes: 3, **attrs)
    create(:portfolio_skill, portfolio: portfolio, skill_label: label, ai_level: level, ai_confidence: confidence,
                             coverage_state: 'covered', probe_count: probes, **attrs)
  end

  def not_assessed(label, reason: 'not_covered')
    create(:portfolio_skill, portfolio: portfolio, skill_label: label, ai_level: nil, ai_confidence: nil,
                             rating_status: 'not_assessed', not_assessed_reason: reason, evidence: [],
                             coverage_state: 'not_yet', probe_count: 0)
  end

  def narrative_report(**attrs)
    create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, skill_comparisons: [],
                            overall_narrative: 'Contoh narasi AI.', **attrs)
  end

  def current_digest
    FitGap::ReportPresenter.new(portfolio: portfolio, vacancy: vacancy).input_digest
  end

  describe 'assessor review' do
    let!(:skill) { rated('SQL & Data Modeling', 2, confidence: 'low', probes: 1) }

    before { require_skill('SQL & Data Modeling', 3) }

    it 'renders an overridden skill (was a 500) with the AI level, note, assessor and time' do
      travel_to(Time.utc(2026, 10, 24, 9, 30)) do
        PortfolioSkills::OverrideActions.new(skill, actor_id: 7).set(level: 3, notes: 'Contoh: tugas tertulis kuat.')
      end

      text = pdf_text

      expect(text).to include('Level: L3', 'Assessor override', 'AI level: L2', 'Contoh: tugas tertulis kuat.',
                              'Assessor #7', '2026-10-24 09:30 UTC')
      expect(text).to include('Candidate: L3 (Assessor override, AI L2)', 'Result: Match')
    end

    it 'marks an AI level confirmed by an assessor, with the note' do
      travel_to(Time.utc(2026, 10, 24, 11, 0)) do
        PortfolioSkills::OverrideActions.new(skill, actor_id: 9).confirm(notes: 'Contoh: bukti cukup.')
      end

      text = pdf_text

      expect(text).to include('Level: L2', 'Confirmed by assessor', 'Contoh: bukti cukup.', 'Assessor #9',
                              '2026-10-24 11:00 UTC', 'Candidate: L2 (Confirmed by assessor)', 'Result: Gap -1')
    end
  end

  it 'writes a not-assessed skill as Not assessed with its reason, never as a level' do
    require_skill('System Design', 4)
    not_assessed('System Design')

    text = pdf_text

    expect(text).to include('Level: Not assessed', 'Not covered in the interview',
                            'Candidate: Not assessed', 'Result: Not assessed (not counted)')
    expect(text).not_to match(/Level: L\d/)
    expect(text).to match(/Follow up.*System Design/)
  end

  it 'shows low confidence with the probe count and keeps it out of the fit totals' do
    require_skill('Rails', 3)
    rated('Rails', 3, confidence: 'low', probes: 1)

    text = pdf_text

    expect(text).to include('Confidence: Low (1 probe)', 'Result: Low confidence, tentatively matches (not counted)',
                            'Counted toward fit: 0 of 1')
    expect(text).to match(/Follow up.*Rails/)
  end

  it 'says when the probe count was not recorded (portfolios from before coverage was stored)' do
    rated('Rails', 3, probes: nil, coverage_state: nil)

    expect(pdf_text).to include('Confidence: High (probes not recorded)')
  end

  describe 'narrative status' do
    before do
      require_skill('Rails', 3)
      rated('Rails', 3)
    end

    it 'prints a ready narrative with the AI label' do
      narrative_report(status: 'complete', narrative_source: 'ai', input_digest: current_digest)

      expect(pdf_text).to include('AI narrative: Ready', 'AI generated, not a hiring decision', 'Contoh narasi AI.')
    end

    it 'still exports when the narrative failed, saying so without any narrative text' do
      narrative_report(status: 'failed', error_code: 'timeout')

      text = pdf_text

      expect(text).to include('AI narrative: Failed', 'could not be generated')
      expect(text).not_to include('Contoh narasi AI.')
    end

    it 'marks a narrative written before the ratings changed as outdated and does not print it' do
      narrative_report(status: 'complete', narrative_source: 'ai', input_digest: 'digest-of-older-ratings')

      text = pdf_text

      expect(text).to include('AI narrative: Outdated', 'Ratings changed after this narrative was written')
      expect(text).not_to include('Contoh narasi AI.')
    end

    it 'says the narrative is still being written' do
      narrative_report(status: 'generating', overall_narrative: nil)

      expect(pdf_text).to include('AI narrative: Generating')
    end

    it 'says when no narrative was requested' do
      expect(pdf_text).to include('AI narrative: Not requested')
    end

    it 'never prints a legacy template sentence as AI text' do
      narrative_report(status: 'complete', narrative_source: 'legacy_fallback', input_digest: current_digest)

      expect(pdf_text).not_to include('Contoh narasi AI.')
    end
  end

  # Skill labels are varchar(255) in every table, so the longest possible
  # name (255 characters, no spaces to break on) is used; evidence has no
  # limit and is tested at 5,000 characters.
  describe 'very long text (255-character skill name, 5,000-character evidence)' do
    let(:long_label)    { "Contoh#{(1..100).map(&:to_s).join('-')}AKHIRLABEL"[-255..] }
    let(:long_evidence) { "Kutipan contoh panjang #{'kata ' * 1_000}"[0, 4_990] + 'AKHIRBUKTI' }

    before do
      require_skill(long_label, 3)
      rated(long_label, 3, evidence: [long_evidence], competency_summary: 'Contoh ringkasan.')
    end

    it 'prints the full skill name and evidence, without cutting them' do
      expect([long_label.length, long_evidence.length]).to eq([255, 5_000])

      text = pdf_text.delete(' ')

      expect(text).to include(long_label, long_evidence.delete(' '))
    end

    it 'keeps every line inside the page' do
      pages = pdf_pages

      expect(pages.size).to be > 1
      pages.each do |page|
        _llx, _lly, urx, ury = page.attributes[:MediaBox]
        page.runs.each do |run|
          expect(run.x).to be >= 0
          expect(run.endx).to be <= urx
          expect(run.y).to be_between(0, ury)
        end
      end
    end
  end

  describe 'non-ASCII text' do
    let(:replaced_note) { 'Some characters were replaced for printing. The original text is shown in the web report.' }

    it 'renders arrows, accented letters and Javanese script as written, with no replacement note' do
      rated('Desain API → REST', 3, evidence: ['Café, señor, über, Łódź.', 'ꦲꦏ꧀ꦱꦫꦗꦮ'])

      text = pdf_text

      expect(text).to include('Desain API → REST', 'Café, señor, über, Łódź.', 'ꦲꦏ꧀ꦱꦫꦗꦮ')
      expect(text).not_to include(replaced_note)
    end

    it 'transliterates symbols the fonts lack and marks emoji and other characters' do
      rated('Rails', 3, evidence: ['Pengalaman ≥ 5 tahun', 'Batas ≤ 3', 'Jika A ⇒ B', 'Lulus ✓ gagal ✗',
                                   'Bagus 😀 sekali 👍🏽', 'Huruf Tamil த'])

      text = pdf_text

      expect(text).to include('Pengalaman >= 5 tahun', 'Batas <= 3', 'Jika A => B', 'Lulus [check] gagal [cross]',
                              'Bagus [emoji] sekali [emoji]', 'Huruf Tamil [?]')
    end

    it 'adds the replacement note once, at the end, only when something was replaced' do
      rated('Rails', 3, evidence: ['Pengalaman ≥ 5 tahun', 'Bagus 😀'])

      text = pdf_text

      expect(text.scan(replaced_note).size).to eq(1)
      expect(text).to end_with(replaced_note)
    end
  end

  it 'exports a vacancy without required skills with a clear note instead of an empty table' do
    rated('Rails', 3)

    expect(pdf_text).to include('This vacancy has no required skills, so there is nothing to compare.')
  end

  it 'exports a portfolio without skills, listing every required skill for follow-up' do
    require_skill('Rails', 3)
    require_skill('API Design', 2)

    text = pdf_text

    expect(text).to include('This portfolio has no skills.', 'Counted toward fit: 0 of 2')
    expect(text).to match(/Follow up.*Rails.*API Design/)
  end

  it 'exports a portfolio only, without a vacancy' do
    rated('Rails', 3)

    text = pdf_text(render_pdf(with_vacancy: nil))

    expect(text).to include('Rails', 'Level: L3')
    expect(text).not_to include('Fit/Gap')
  end

  it 'shows a banner on a legacy portfolio generated before ratings were validated' do
    portfolio.update!(ratings_validated: false)
    rated('Rails', 3)

    expect(pdf_text).to include('Legacy portfolio')
  end

  it 'shows no legacy banner on a validated portfolio' do
    rated('Rails', 3)

    expect(pdf_text).not_to include('Legacy portfolio')
  end
end
