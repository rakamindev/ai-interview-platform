# frozen_string_literal: true

require 'prawn'
require 'zip'
require 'base64'
require 'fileutils'

# Reproducibly generates the CV-parsing edge-case fixtures used by
# spec/services/cv_screening/text_extractor_spec.rb. All content is fabricated —
# committing a real CV (or a real name/email) to git history is a PDP incident
# that never goes away. Not every case from the plan doc is covered here: a
# genuinely password-protected/encrypted PDF isn't constructible with the gems
# available in this app, and is unit-tested via a stubbed PDF::Reader exception
# instead (see the spec). "Legacy .doc" is simulated by writing real OLE2 magic
# bytes under a .docx name — TextExtractor dispatches on sniffed bytes, never the
# extension, so this genuinely exercises that branch without needing MS Word.
namespace :cv_screening do
  desc 'Generate spec/fixtures/files/* used by CV screening specs'
  task generate_fixtures: :environment do
    dir = Rails.root.join('spec/fixtures/files')
    FileUtils.mkdir_p(dir)

    # 1. A real, parseable text-layer PDF.
    text_pdf = Prawn::Document.new
    text_pdf.text('Jordan Example', size: 16)
    text_pdf.text('jordan.example@test.invalid')
    text_pdf.text('Fabricated CV content for TextExtractor specs — not a real person.')
    text_pdf.text('Experience: 5 years of fabricated Ruby on Rails experience.')
    text_bytes = text_pdf.render
    File.binwrite(dir.join('cv_text_layer.pdf'), text_bytes)

    # 2. No extractable text at all — stands in for an image-only scanned PDF.
    image_only_pdf = Prawn::Document.new
    image_only_pdf.fill_rectangle([100, 700], 300, 100)
    File.binwrite(dir.join('cv_image_only.pdf'), image_only_pdf.render)

    # 3. Zero bytes.
    File.binwrite(dir.join('cv_zero_byte.pdf'), '')

    # 4. Truncated/corrupt — a valid PDF's bytes cut off partway through.
    File.binwrite(dir.join('cv_truncated.pdf'), text_bytes[0...(text_bytes.bytesize / 3)])

    # 5. Legacy .doc (OLE2 magic bytes), renamed .docx — Marcel sniffs the real
    #    bytes, not the extension, so this hits TextExtractor's :legacy_doc branch.
    ole2_signature = "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1".b
    File.binwrite(dir.join('cv_legacy_doc.docx'), ole2_signature + ("\x00".b * 512))

    # 6. A real PNG, renamed .pdf — extension lies, sniffed bytes don't.
    tiny_png = Base64.decode64(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA' \
      '60e6kgAAAABJRU5ErkJggg=='
    )
    File.binwrite(dir.join('cv_png_renamed.pdf'), tiny_png)

    # 7. A minimal but genuinely valid DOCX (zip + word/document.xml), hand-built
    #    with rubyzip — no MS Word needed.
    document_xml = <<~XML
      <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Taylor Example</w:t></w:r></w:p>
          <w:p><w:r><w:t>taylor.example@test.invalid</w:t></w:r></w:p>
          <w:p><w:r><w:t>Fabricated CV content for TextExtractor specs — not a real person.</w:t></w:r></w:p>
        </w:body>
      </w:document>
    XML

    content_types_xml = <<~XML
      <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>
    XML

    rels_xml = <<~XML
      <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>
    XML

    docx_path = dir.join('cv_sample.docx')
    File.delete(docx_path) if File.exist?(docx_path)
    Zip::File.open(docx_path.to_s, create: true) do |zip|
      zip.get_output_stream('[Content_Types].xml') { |f| f.write(content_types_xml) }
      zip.get_output_stream('_rels/.rels') { |f| f.write(rels_xml) }
      zip.get_output_stream('word/document.xml') { |f| f.write(document_xml) }
    end

    puts "Wrote fixtures to #{dir}"
  end
end
