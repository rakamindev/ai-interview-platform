# frozen_string_literal: true

module Exports
  # A Prawn document using the bundled Noto fonts (SIL OFL 1.1, see
  # vendor/fonts/OFL.txt), so any Latin, accented or symbol text in a rating
  # renders instead of failing on Prawn's Windows-1252 built-in fonts.
  # Javanese script and symbols such as arrows fall back to Noto Sans
  # Javanese and Noto Sans Symbols. Characters the fonts lack are replaced
  # for printing only (the data and the API keep the original text): a few
  # symbols are transliterated, emoji become EMOJI and anything else becomes
  # MISSING_GLYPH, so the reader can see that something was replaced.
  class PdfCanvas
    FONT_DIR      = Rails.root.join('vendor', 'fonts')
    MAIN_FONT     = 'NotoSans'
    FALLBACK_FONTS = { 'NotoSansJavanese' => 'NotoSansJavanese-Regular.ttf',
                       'NotoSansSymbols' => 'NotoSansSymbols-Regular.ttf' }.freeze
    MISSING_GLYPH = '[?]'
    EMOJI         = '[emoji]'
    TRANSLITERATIONS = { '≥' => '>=', '≤' => '<=', '⇒' => '=>', '✓' => '[check]', '✗' => '[cross]' }.freeze
    EMOJI_PATTERN = /\p{Extended_Pictographic}/
    # Space a heading needs below it, so it is never left alone at the
    # bottom of a page.
    HEADING_KEEP_WITH_NEXT = 60

    attr_reader :pdf

    def initialize(pdf)
      @pdf = pdf
      @glyphs = {}
      @replaced = false
      register_fonts
    end

    # True once any printed text had a character replaced.
    def replaced?
      @replaced
    end

    def text(value, size: 10, style: :normal, color: nil)
      options = { size: size, style: style }
      options[:color] = color if color
      @pdf.text(safe(value), **options)
    end

    def heading(value, size: 13)
      @pdf.start_new_page if @pdf.cursor < HEADING_KEEP_WITH_NEXT
      text(value, size: size, style: :bold)
      @pdf.move_down 4
    end

    # Replaces every character cluster that no bundled font can draw.
    def safe(value)
      value.to_s.each_grapheme_cluster.map { |cluster| printable(cluster) }.join
    end

    private

    def register_fonts
      main = { normal: FONT_DIR.join('NotoSans-Regular.ttf').to_s, bold: FONT_DIR.join('NotoSans-Bold.ttf').to_s }
      fallbacks = FALLBACK_FONTS.transform_values do |file|
        path = FONT_DIR.join(file).to_s
        { normal: path, bold: path }
      end
      @pdf.font_families.update(MAIN_FONT => main, **fallbacks)
      @pdf.font(MAIN_FONT)
      @pdf.fallback_fonts(FALLBACK_FONTS.keys)
    end

    def printable(cluster)
      replacement = TRANSLITERATIONS[cluster]
      replacement ||= EMOJI if cluster.match?(EMOJI_PATTERN) && !drawable?(cluster)
      replacement ||= MISSING_GLYPH unless drawable?(cluster)
      return cluster unless replacement

      @replaced = true
      replacement
    end

    def drawable?(cluster)
      cluster.match?(/\A\s+\z/) || cluster.each_char.all? { |char| glyph?(char) }
    end

    def glyph?(char)
      @glyphs.fetch(char) do
        @glyphs[char] = fonts.any? { |font| font.glyph_present?(char) }
      end
    end

    def fonts
      @fonts ||= [MAIN_FONT, *FALLBACK_FONTS.keys].map { |family| @pdf.find_font(family) }
    end
  end
end
