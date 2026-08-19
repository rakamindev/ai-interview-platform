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
ARG BUNDLE_WITHOUT="development test"
ARG BUNDLE_DEPLOYMENT="true"
RUN bundle config set --local without "$BUNDLE_WITHOUT" && \
    if [ "$BUNDLE_DEPLOYMENT" = "true" ]; then \
      bundle install --deployment --frozen --jobs 4; \
    else \
      bundle install --jobs 4; \
    fi

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

ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2

RUN mkdir -p tmp/pids tmp/cache tmp/sockets log

EXPOSE 3001

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
