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
RUN bundle config set --local deployment true && \
    bundle config set --local frozen true && \
    if [ -n "$BUNDLE_WITHOUT" ]; then bundle config set --local without "$BUNDLE_WITHOUT"; fi && \
    bundle install --jobs 4

COPY . .

FROM ruby:3.3.2

RUN apt-get update && apt-get install -y --no-install-recommends \
  libpq-dev \
  tzdata \
  libjemalloc2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /ai-interview

COPY --from=builder /usr/local/bundle /usr/local/bundle
COPY --from=builder /ai-interview /ai-interview

RUN mkdir -p tmp/pids tmp/cache tmp/sockets log

EXPOSE 3001

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
