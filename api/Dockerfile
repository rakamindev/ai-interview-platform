FROM ruby:3.3.2 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  git \
  libpq-dev \
  tzdata \
  libjemalloc2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /ai-interview

COPY Gemfile Gemfile.lock ./
RUN bundle config set --local without 'development test' && \
    bundle install --deployment --frozen --jobs 4

COPY . .

# ============================================================================

FROM ruby:3.3.2

RUN apt-get update && apt-get install -y --no-install-recommends \
  libpq-dev \
  tzdata \
  libjemalloc2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /ai-interview

COPY --from=builder /usr/local/bundle /usr/local/bundle
COPY --from=builder /ai-interview /ai-interview

ENV LD_PRELOAD=libjemalloc.so.2

RUN mkdir -p tmp/pids tmp/cache tmp/sockets log && \
    groupadd --system --gid 1000 app && \
    useradd --system --uid 1000 --gid app --home-dir /ai-interview app && \
    chown -R app:app /ai-interview

USER app

EXPOSE 3001




CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
