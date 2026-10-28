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

# postgresql-client-16 provides psql/pg_dump, used by `rails db:schema:load`
# and `db:schema:dump` now that schema_format is :sql (config/application.rb)
# — required because this app creates a custom Postgres schema via raw SQL,
# which the default :ruby schema.rb format cannot represent.
#
# The plain Debian bookworm "postgresql-client" package is v15; pg_dump
# refuses to run against a newer server (this app runs Postgres 16, e.g.
# postgres:16-alpine in docker-compose), so the matching version is pulled
# from the official PGDG apt repo instead.
RUN apt-get update && apt-get install -y --no-install-recommends \
  libpq-dev \
  tzdata \
  libjemalloc2 \
  curl \
  gnupg \
  lsb-release \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update && apt-get install -y --no-install-recommends postgresql-client-16 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /ai-interview

COPY --from=builder /usr/local/bundle /usr/local/bundle
COPY --from=builder /ai-interview /ai-interview

ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2

RUN mkdir -p tmp/pids tmp/cache tmp/sockets log

EXPOSE 3001

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
