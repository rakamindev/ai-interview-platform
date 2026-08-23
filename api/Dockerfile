FROM ruby:3.3.2 AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
  libpq-dev \
  postgresql-client \
  tzdata \
  libjemalloc2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /ai-interview

ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2

RUN mkdir -p tmp/pids tmp/cache tmp/sockets log

EXPOSE 3001

# ============================================================================

FROM ruby:3.3.2 AS prod-builder

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

FROM base AS production

COPY --from=prod-builder /usr/local/bundle /usr/local/bundle
COPY --from=prod-builder /ai-interview /ai-interview

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]

# ============================================================================

FROM base AS dev

RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  git \
  && rm -rf /var/lib/apt/lists/*

COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs 4

COPY . .

COPY bin/docker-entrypoint /usr/local/bin/docker-entrypoint
RUN chmod +x /usr/local/bin/docker-entrypoint

ENTRYPOINT ["docker-entrypoint"]
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
