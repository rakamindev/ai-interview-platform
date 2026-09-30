# Use an official Ruby runtime as a parent image
FROM ruby:3.3.2-slim-bullseye

# Set working directory
WORKDIR /app

# Set frontend non-interactive to prevent hanging during build
ENV DEBIAN_FRONTEND=noninteractive

# Install build essentials and PostgreSQL client libraries
RUN echo 'Acquire::Check-Valid-Until "false";' > /etc/apt/apt.conf.d/99no-check-valid-until && \
    sed -i '/bullseye-security/d' /etc/apt/sources.list && \
    echo "deb http://snapshot.debian.org/archive/debian-security/20240310T110000Z bullseye-security main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://snapshot.debian.org/archive/debian/20240310T110000Z bullseye main contrib non-free" >> /etc/apt/sources.list && \
    apt-get update -y && \
    apt-get install -y --no-install-recommends build-essential libpq-dev && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

# Install Node.js from NodeSource (more reliable for specific versions)
RUN apt-get update -y && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

# Install Bundler
RUN gem install bundler:2.5.11

# Copy Gemfile and Gemfile.lock
COPY Gemfile Gemfile.lock ./ 

# Install dependencies
RUN bundle install --jobs=$(nproc) --without development test

# Copy the rest of the application code
COPY . .

# Expose port 3000 to the Docker host
EXPOSE 3000

# Command to run the Rails server
CMD ["bundle", "exec", "rails", "s", "-b", "0.0.0.0"]
