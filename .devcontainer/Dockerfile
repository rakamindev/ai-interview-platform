FROM ruby:3.3.2-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    libpq-dev \
    postgresql-client \
    tzdata \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Match the Bundler version pinned in api/Gemfile.lock so `bundle install`
# doesn't stall on a version mismatch.
RUN gem install bundler:2.5.11

# Node, for the web app — installed directly (not as a devcontainer Feature)
# so this image is also usable with plain `docker compose up`, no VS Code required.
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
