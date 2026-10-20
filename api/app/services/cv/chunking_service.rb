# frozen_string_literal: true

module Cv
  # Splits normalized CV text into semantic, project-oriented chunks with rich metadata.
  # Avoids naive byte splitting to preserve sentence integrity and context for micro-RAG retrieval.
  class ChunkingService
    KNOWN_TECHNOLOGIES = %w[
      Ruby Rails Go Golang Python Django FastAPI Node.js Node React React.js
      TypeScript JavaScript Vue.js Angular PostgreSQL Postgres MySQL Redis
      Kafka RabbitMQ Elasticsearch Docker Kubernetes K8s AWS GCP Azure Terraform
      GraphQL gRPC Docker-Compose CI/CD Linux Nginx Microservices
    ].freeze

    SECTION_PATTERNS = {
      'experience' => /\A(?:\#{1,3}\s*)?(?:work\s+experience|professional\s+experience|employment\s+history|experience)\b/i,
      'projects'   => /\A(?:\#{1,3}\s*)?(?:projects|key\s+projects|notable\s+projects|technical\s+projects)\b/i,
      'skills'     => /\A(?:\#{1,3}\s*)?(?:skills|technical\s+skills|core\s+competencies|technologies)\b/i,
      'education'  => /\A(?:\#{1,3}\s*)?(?:education|academic\s+background|certifications)\b/i,
      'summary'    => /\A(?:\#{1,3}\s*)?(?:summary|professional\s+summary|profile|about\s+me)\b/i
    }.freeze

    def self.call(text, session: nil)
      new(text, session: session).call
    end

    def initialize(text, session: nil)
      @text = text.to_s
      @session = session
    end

    def call
      sections = extract_sections(@text)
      chunks = build_chunks(sections)

      persist_chunks!(chunks) if @session.present?
      chunks
    end

    private

    def extract_sections(text)
      lines = text.split("\n")
      sections = []
      current_section = 'summary'
      current_lines = []

      lines.each do |line|
        trimmed = line.strip
        detected = detect_section_header(trimmed)

        if detected
          sections << { section_type: current_section, content: current_lines.join("\n").strip } if current_lines.any?
          current_section = detected
          current_lines = []
        else
          current_lines << line
        end
      end

      sections << { section_type: current_section, content: current_lines.join("\n").strip } if current_lines.any?
      sections.reject { |s| s[:content].blank? }
    end

    def detect_section_header(line)
      return nil if line.blank? || line.length > 60

      SECTION_PATTERNS.each do |type, regex|
        return type if line.match?(regex)
      end
      nil
    end

    def build_chunks(sections)
      all_chunks = []
      chunk_index = 0

      sections.each do |section|
        paragraphs = split_into_paragraphs(section[:content])
        buffer = []
        current_word_count = 0

        paragraphs.each do |paragraph|
          p_words = paragraph.split(/\s+/).count

          # If adding this paragraph exceeds ~200 words and we already have content, flush chunk
          if current_word_count > 0 && (current_word_count + p_words) > 220
            chunk_content = buffer.join("\n\n").strip
            all_chunks << create_chunk_hash(chunk_index, section[:section_type], chunk_content)
            chunk_index += 1
            buffer = []
            current_word_count = 0
          end

          buffer << paragraph
          current_word_count += p_words
        end

        if buffer.any?
          chunk_content = buffer.join("\n\n").strip
          all_chunks << create_chunk_hash(chunk_index, section[:section_type], chunk_content)
          chunk_index += 1
        end
      end

      all_chunks
    end

    def split_into_paragraphs(text)
      paragraphs = text.split(/\n\s*\n/).map(&:strip).reject(&:blank?)
      return [text.strip] if paragraphs.empty? && text.present?

      paragraphs
    end

    def create_chunk_hash(index, section_type, content)
      metadata = extract_metadata(content)
      {
        chunk_index:  index,
        section_type: section_type,
        content:      content,
        metadata:     metadata
      }
    end

    def extract_metadata(content)
      technologies = KNOWN_TECHNOLOGIES.select do |tech|
        content.match?(/\b#{Regexp.escape(tech)}\b/i)
      end.uniq

      company = detect_company(content)
      role    = detect_role(content)

      meta = { 'technologies' => technologies }
      meta['company'] = company if company.present?
      meta['role']    = role if role.present?
      meta
    end

    def detect_company(content)
      first_line = content.lines.first.to_s.strip
      if (match = first_line.match(/(?:at|@)\s+([A-Z][A-Za-z0-9&.\s]{2,30}?)(?:\s*\(|\s*[-–|,]|\s*$)/))
        match[1].strip
      elsif (match = first_line.match(/\A([A-Z][A-Za-z0-9&.\s]{2,30}?)\s*[-–|]\s*(?:Senior|Lead|Staff|Software|Backend|Frontend|Engineer|Developer)/i))
        match[1].strip
      end
    end

    def detect_role(content)
      first_line = content.lines.first.to_s.strip
      if (match = first_line.match(/\b((?:Senior|Lead|Staff|Principal|Junior)?\s*(?:Software|Backend|Frontend|Fullstack|DevOps|Site Reliability|Cloud)?\s*(?:Engineer|Developer|Architect|Manager))\b/i))
        match[1].strip
      end
    end

    def persist_chunks!(chunks)
      ActiveRecord::Base.transaction do
        @session.candidate_cv_chunks.delete_all

        chunks.each do |c|
          @session.candidate_cv_chunks.create!(
            chunk_index:  c[:chunk_index],
            section_type: c[:section_type],
            content:      c[:content],
            metadata:     c[:metadata]
          )
        end
      end
    end
  end
end
